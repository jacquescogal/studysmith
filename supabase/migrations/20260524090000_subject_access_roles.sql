alter table public.subject_access
  drop constraint if exists ck_subject_access_access_level;

update public.subject_access
set access_level = case access_level
  when 'read' then 'reader'
  when 'edit' then 'maintainer'
  else access_level
end
where access_level in ('read', 'edit');

alter table public.subject_access
  add constraint ck_subject_access_access_level
  check (access_level in ('maintainer', 'owner', 'reader'));

create unique index if not exists uq_subject_access_single_owner
  on public.subject_access (subject_id)
  where access_level = 'owner';
