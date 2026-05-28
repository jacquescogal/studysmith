alter table if exists users
  add column if not exists creator_role_requested_at timestamptz;
