create table if not exists public.username_reservations (
  username_normalized varchar primary key,
  created_at timestamp,
  updated_at timestamp
);

create index if not exists ix_username_reservations_username_normalized
on public.username_reservations (username_normalized);

insert into public.username_reservations (username_normalized)
select username_normalized
from public.users
where username_normalized is not null
on conflict (username_normalized) do nothing;

insert into public.username_reservations (username_normalized)
select username_normalized
from public.pending_registrations
where username_normalized is not null
on conflict (username_normalized) do nothing;

alter table public.username_reservations enable row level security;
revoke all on table public.username_reservations from anon, authenticated;
