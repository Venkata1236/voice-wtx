-- ── Email OTP verification ────────────────────────────────────────
-- New signups must verify their email with a one-time 6-digit code
-- before they can log in.

-- 1. Add email_verified to users. Existing users are backfilled to TRUE
--    so nobody currently active gets locked out.
alter table users add column if not exists email_verified boolean default false;
update users set email_verified = true where email_verified is distinct from true;

-- 2. OTP store — only a hash of the code is kept, never the raw code.
create table if not exists email_otps (
    id uuid primary key default uuid_generate_v4(),
    email text not null,
    otp_hash text not null,
    expires_at timestamptz not null,
    attempts int default 0,
    used boolean default false,
    created_at timestamptz default now()
);
create index if not exists idx_email_otps_email on email_otps(email);