create table if not exists public.subject_activity_events (
  id varchar not null,
  subject_id varchar not null,
  actor_user_id varchar,
  event_type varchar not null,
  entity_type varchar not null,
  entity_id varchar not null,
  entity_title text,
  created_at timestamp without time zone,
  primary key (id),
  constraint ck_subject_activity_events_event_type check (event_type in ('created', 'deleted')),
  constraint ck_subject_activity_events_entity_type check (entity_type in ('module', 'note_group', 'question_card', 'study_card')),
  foreign key(subject_id) references public.subjects (id) on delete cascade,
  foreign key(actor_user_id) references public.users (id) on delete set null
);

create index if not exists ix_subject_activity_events_actor_user_id
  on public.subject_activity_events (actor_user_id);
create index if not exists ix_subject_activity_events_created_at
  on public.subject_activity_events (created_at);
create index if not exists ix_subject_activity_events_subject_id
  on public.subject_activity_events (subject_id);

alter table public.subject_activity_events disable row level security;
