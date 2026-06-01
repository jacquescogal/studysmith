create table if not exists public.pending_registrations (
  id varchar primary key,
  email varchar not null unique,
  username varchar not null,
  username_normalized varchar not null unique,
  created_at timestamp,
  updated_at timestamp
);

create unique index if not exists ix_pending_registrations_email
on public.pending_registrations (email);

create unique index if not exists ix_pending_registrations_username_normalized
on public.pending_registrations (username_normalized);

alter table public.pending_registrations enable row level security;
revoke all on table public.pending_registrations from anon, authenticated;
