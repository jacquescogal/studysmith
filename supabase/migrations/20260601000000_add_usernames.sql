alter table users add column if not exists username varchar;
alter table users add column if not exists username_normalized varchar;

create unique index if not exists ix_users_username_normalized
on users (username_normalized)
where username_normalized is not null;
