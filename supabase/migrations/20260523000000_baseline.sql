create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.users (
  id varchar not null,
  supabase_user_id varchar not null,
  email varchar not null,
  app_role varchar not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint ck_users_app_role check (app_role in ('admin', 'creator', 'reader'))
);

create unique index ix_users_email on public.users (email);
create unique index ix_users_supabase_user_id on public.users (supabase_user_id);

create table public.subjects (
  id varchar not null,
  title varchar not null,
  description text,
  goal text,
  scope text,
  owner_user_id varchar,
  visibility varchar not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint ck_subjects_visibility check (visibility in ('private', 'public', 'public_requested')),
  unique (title),
  foreign key(owner_user_id) references public.users (id)
);

create index ix_subjects_owner_user_id on public.subjects (owner_user_id);
create index ix_subjects_visibility on public.subjects (visibility);

create table public.subject_access (
  id varchar not null,
  subject_id varchar not null,
  user_id varchar not null,
  access_level varchar not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint ck_subject_access_access_level check (access_level in ('maintainer', 'owner', 'reader')),
  constraint uq_subject_access_user unique (subject_id, user_id),
  foreign key(subject_id) references public.subjects (id) on delete cascade,
  foreign key(user_id) references public.users (id) on delete cascade
);

create unique index uq_subject_access_single_owner
  on public.subject_access (subject_id)
  where access_level = 'owner';

create table public.subject_short_codes (
  subject_id varchar not null,
  short_code varchar not null,
  created_at timestamp without time zone,
  primary key (subject_id),
  foreign key(subject_id) references public.subjects (id) on delete cascade
);

create unique index ix_subject_short_codes_short_code on public.subject_short_codes (short_code);

create table public.subject_activity_events (
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

create index ix_subject_activity_events_actor_user_id on public.subject_activity_events (actor_user_id);
create index ix_subject_activity_events_created_at on public.subject_activity_events (created_at);
create index ix_subject_activity_events_subject_id on public.subject_activity_events (subject_id);

create table public.modules (
  id varchar not null,
  subject_id varchar not null,
  title varchar not null,
  description text,
  goal text,
  scope text,
  settings_json text,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(subject_id) references public.subjects (id),
  unique (title)
);

create table public.module_short_codes (
  module_id varchar not null,
  short_code varchar not null,
  created_at timestamp without time zone,
  primary key (module_id),
  foreign key(module_id) references public.modules (id) on delete cascade
);

create unique index ix_module_short_codes_short_code on public.module_short_codes (short_code);

create table public.note_groups (
  id varchar not null,
  module_id varchar not null,
  title varchar,
  source text,
  source_normalized varchar,
  raw_text text not null,
  additional_generation_instructions text,
  cleaned_text_markdown text,
  formatted_text text,
  formatted_sections_json text,
  generation_status varchar,
  suggested_titles_json text,
  sort_order integer,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(module_id) references public.modules (id)
);

create index ix_note_groups_source_normalized on public.note_groups (source_normalized);

create table public.topic_chips (
  id varchar not null,
  module_id varchar not null,
  label varchar not null,
  description text,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(module_id) references public.modules (id)
);

create table public.note_group_topic_chips (
  note_group_id varchar not null,
  chip_id varchar not null,
  primary key (note_group_id, chip_id),
  foreign key(note_group_id) references public.note_groups (id),
  foreign key(chip_id) references public.topic_chips (id)
);

create table public.note_group_short_codes (
  note_group_id varchar not null,
  short_code varchar not null,
  created_at timestamp without time zone,
  primary key (note_group_id),
  foreign key(note_group_id) references public.note_groups (id) on delete cascade
);

create unique index ix_note_group_short_codes_short_code on public.note_group_short_codes (short_code);

create table public.study_cards (
  id varchar not null,
  note_group_id varchar not null,
  title varchar,
  content text not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(note_group_id) references public.note_groups (id)
);

create table public.question_cards (
  id varchar not null,
  note_group_id varchar not null,
  type varchar not null,
  prompt text not null,
  options_json text not null,
  correct_option_indices_json text not null,
  option_explanations_json text,
  study_card_refs_json text not null,
  stale boolean,
  due_at timestamp without time zone,
  last_review_at timestamp without time zone,
  stability double precision,
  difficulty double precision,
  elapsed_days integer,
  scheduled_days integer,
  reps integer,
  lapses integer,
  state integer,
  step integer,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(note_group_id) references public.note_groups (id)
);

create table public.topic_chip_short_codes (
  topic_chip_id varchar not null,
  short_code varchar not null,
  created_at timestamp without time zone,
  primary key (topic_chip_id),
  foreign key(topic_chip_id) references public.topic_chips (id) on delete cascade
);

create unique index ix_topic_chip_short_codes_short_code on public.topic_chip_short_codes (short_code);

create table public.jobs (
  id varchar not null,
  type varchar not null,
  status varchar,
  note_group_id varchar,
  payload_json text,
  error text,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(note_group_id) references public.note_groups (id)
);

create table public.study_card_topic_chips (
  study_card_id varchar not null,
  chip_id varchar not null,
  primary key (study_card_id, chip_id),
  foreign key(study_card_id) references public.study_cards (id),
  foreign key(chip_id) references public.topic_chips (id)
);

create table public.study_card_embeddings (
  study_card_id varchar not null,
  module_id varchar not null,
  note_group_id varchar not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (study_card_id),
  foreign key(study_card_id) references public.study_cards (id) on delete cascade,
  foreign key(module_id) references public.modules (id) on delete cascade,
  foreign key(note_group_id) references public.note_groups (id) on delete cascade
);

create index ix_study_card_embeddings_module_id on public.study_card_embeddings (module_id);
create index ix_study_card_embeddings_note_group_id on public.study_card_embeddings (note_group_id);
create index ix_study_card_embeddings_embedding_hnsw
  on public.study_card_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.study_card_source_ranges (
  id varchar not null,
  note_group_id varchar not null,
  study_card_id varchar not null,
  start_index integer not null,
  end_index integer not null,
  created_at timestamp without time zone,
  primary key (id),
  foreign key(note_group_id) references public.note_groups (id),
  foreign key(study_card_id) references public.study_cards (id)
);

create table public.question_card_learning_states (
  id varchar not null,
  question_card_id varchar not null,
  user_id varchar not null,
  disabled boolean not null,
  due_at timestamp without time zone,
  last_review_at timestamp without time zone,
  stability double precision,
  difficulty double precision,
  elapsed_days integer,
  scheduled_days integer,
  reps integer,
  lapses integer,
  state integer,
  step integer,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_question_card_learning_state_user unique (question_card_id, user_id),
  foreign key(question_card_id) references public.question_cards (id) on delete cascade,
  foreign key(user_id) references public.users (id) on delete cascade
);

create index ix_question_card_learning_states_question_card_id on public.question_card_learning_states (question_card_id);
create index ix_question_card_learning_states_user_id on public.question_card_learning_states (user_id);

create table public.question_card_reviews (
  id varchar not null,
  question_card_id varchar not null,
  user_id varchar not null,
  note_group_id varchar not null,
  module_id varchar not null,
  correct boolean not null,
  response_time_ms integer not null,
  rating varchar not null,
  previous_due_at timestamp without time zone,
  next_due_at timestamp without time zone,
  previous_difficulty double precision,
  next_difficulty double precision,
  previous_stability double precision,
  next_stability double precision,
  previous_state integer,
  next_state integer,
  previous_reps integer,
  next_reps integer,
  previous_lapses integer,
  next_lapses integer,
  answer_option_indices_json text not null,
  correct_option_indices_json text not null,
  reviewed_at timestamp without time zone,
  primary key (id),
  foreign key(question_card_id) references public.question_cards (id),
  foreign key(user_id) references public.users (id) on delete cascade,
  foreign key(note_group_id) references public.note_groups (id),
  foreign key(module_id) references public.modules (id)
);

create index ix_question_card_reviews_module_id on public.question_card_reviews (module_id);
create index ix_question_card_reviews_note_group_id on public.question_card_reviews (note_group_id);
create index ix_question_card_reviews_question_card_id on public.question_card_reviews (question_card_id);
create index ix_question_card_reviews_reviewed_at on public.question_card_reviews (reviewed_at);
create index ix_question_card_reviews_user_id on public.question_card_reviews (user_id);

alter table public.users disable row level security;
alter table public.subjects disable row level security;
alter table public.subject_access disable row level security;
alter table public.subject_short_codes disable row level security;
alter table public.subject_activity_events disable row level security;
alter table public.modules disable row level security;
alter table public.module_short_codes disable row level security;
alter table public.note_groups disable row level security;
alter table public.topic_chips disable row level security;
alter table public.note_group_topic_chips disable row level security;
alter table public.note_group_short_codes disable row level security;
alter table public.study_cards disable row level security;
alter table public.question_cards disable row level security;
alter table public.topic_chip_short_codes disable row level security;
alter table public.jobs disable row level security;
alter table public.study_card_topic_chips disable row level security;
alter table public.study_card_embeddings disable row level security;
alter table public.study_card_source_ranges disable row level security;
alter table public.question_card_learning_states disable row level security;
alter table public.question_card_reviews disable row level security;
