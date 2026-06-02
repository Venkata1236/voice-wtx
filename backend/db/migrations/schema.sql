-- ── Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────
create table if not exists users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    full_name text not null,
    role text not null check (role in ('admin', 'copy_lead', 'strategist', 'copywriter', 'brand_manager')),
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── Brands ────────────────────────────────────────────────────────
create table if not exists brands (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    category text not null,
    color text default '#6366f1',
    is_archived boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── User Brand Access ─────────────────────────────────────────────
create table if not exists user_brand_access (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references users(id) on delete cascade,
    brand_id uuid references brands(id) on delete cascade,
    created_at timestamptz default now(),
    unique(user_id, brand_id)
);

-- ── Brand Knowledge Base ──────────────────────────────────────────
create table if not exists brand_kb (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brands(id) on delete cascade unique,
    tone_tags jsonb default '[]',
    brand_rules_do jsonb default '[]',
    brand_rules_dont jsonb default '[]',
    brief_template jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── KB Documents ──────────────────────────────────────────────────
create table if not exists kb_documents (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brands(id) on delete cascade,
    doc_type text not null check (doc_type in ('brand_document', 'audience_personas')),
    file_name text not null,
    extracted_text text,
    word_count integer default 0,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    uploaded_by uuid references users(id),
    approved_by uuid references users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── Chat Sessions ─────────────────────────────────────────────────
create table if not exists chat_sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references users(id) on delete cascade,
    brand_id uuid references brands(id) on delete cascade,
    mode text not null check (mode in ('single', 'compare', 'forge')),
    title text,
    is_pinned boolean default false,
    expires_at timestamptz default now() + interval '90 days',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── Copy Variants ─────────────────────────────────────────────────
create table if not exists copy_variants (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid references chat_sessions(id) on delete cascade,
    brand_id uuid references brands(id) on delete cascade,
    model text not null,
    format text not null,
    brief text not null,
    content text not null,
    score integer default 0,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    rejection_reason text,
    agent_generator text,
    agent_critic text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── Approved Posts KB ─────────────────────────────────────────────
create table if not exists approved_posts (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brands(id) on delete cascade,
    variant_id uuid references copy_variants(id) on delete cascade,
    content text not null,
    format text not null,
    model text not null,
    created_at timestamptz default now()
);

-- ── Insights Notes ────────────────────────────────────────────────
create table if not exists insights (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references brands(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    content text not null,
    color text default 'yellow',
    tag text check (tag in ('client_feedback', 'brand_rule', 'important', 'follow_up', 'research')),
    is_pinned boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ── Feature Flags ─────────────────────────────────────────────────
create table if not exists feature_flags (
    id uuid primary key default uuid_generate_v4(),
    flag_name text unique not null,
    is_enabled boolean default false,
    updated_at timestamptz default now()
);

-- ── Seed Feature Flags ────────────────────────────────────────────
insert into feature_flags (flag_name, is_enabled)
values ('forge_mode', false)
on conflict (flag_name) do nothing;

-- ── Updated At Trigger ────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create or replace trigger users_updated_at
    before update on users
    for each row execute function update_updated_at();

create or replace trigger brands_updated_at
    before update on brands
    for each row execute function update_updated_at();

create or replace trigger brand_kb_updated_at
    before update on brand_kb
    for each row execute function update_updated_at();

create or replace trigger kb_documents_updated_at
    before update on kb_documents
    for each row execute function update_updated_at();

create or replace trigger chat_sessions_updated_at
    before update on chat_sessions
    for each row execute function update_updated_at();

create or replace trigger copy_variants_updated_at
    before update on copy_variants
    for each row execute function update_updated_at();

create or replace trigger insights_updated_at
    before update on insights
    for each row execute function update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────
alter table users enable row level security;
alter table brands enable row level security;
alter table user_brand_access enable row level security;
alter table brand_kb enable row level security;
alter table kb_documents enable row level security;
alter table chat_sessions enable row level security;
alter table copy_variants enable row level security;
alter table approved_posts enable row level security;
alter table insights enable row level security;
alter table feature_flags enable row level security;