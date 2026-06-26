-- ── Password Reset Tokens ─────────────────────────────────────────
-- Stores one-time, expiring tokens for the self-service password reset
-- flow. Only a SHA-256 HASH of the token is stored here — the raw token
-- lives only in the emailed link, so a DB leak cannot be used to reset
-- anyone's password.
create table if not exists password_reset_tokens (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    used boolean default false,
    created_at timestamptz default now()
);

-- Fast lookup by token hash on reset, and by user when invalidating old tokens
create index if not exists idx_prt_token_hash on password_reset_tokens(token_hash);
create index if not exists idx_prt_user on password_reset_tokens(user_id);