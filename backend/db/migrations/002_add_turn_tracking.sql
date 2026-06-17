-- ════════════════════════════════════════════════════════════════
-- Migration 002 — Turn tracking for unified Chat view
-- ════════════════════════════════════════════════════════════════

-- ── 1. Allow the new unified 'chat' mode on sessions ──────────────
alter table chat_sessions
    drop constraint if exists chat_sessions_mode_check;

alter table chat_sessions
    add constraint chat_sessions_mode_check
    check (mode in ('single', 'compare', 'forge', 'chat'));

-- ── 2. Add turn columns to copy_variants ──────────────────────────
alter table copy_variants
    add column if not exists turn_id uuid;

alter table copy_variants
    add column if not exists turn_type text;

-- ── 3. Backfill turn_type from each variant's session mode ────────
update copy_variants cv
set turn_type = cs.mode
from chat_sessions cs
where cv.session_id = cs.id
  and cv.turn_type is null
  and cs.mode in ('single', 'compare');

update copy_variants
set turn_type = 'single'
where turn_type is null;

-- ── 4. Backfill turn_id by grouping existing variants ─────────────
with groups as (
    select distinct session_id, brief
    from copy_variants
    where turn_id is null
),
assigned as (
    select session_id, brief, uuid_generate_v4() as tid
    from groups
)
update copy_variants cv
set turn_id = a.tid
from assigned a
where cv.session_id = a.session_id
  and cv.brief = a.brief
  and cv.turn_id is null;

-- ── 5. Indexes for fast thread loading ────────────────────────────
create index if not exists idx_copy_variants_session_created
    on copy_variants (session_id, created_at);

create index if not exists idx_copy_variants_turn
    on copy_variants (turn_id);