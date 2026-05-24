create table if not exists public.job_stages (
  id varchar not null,
  job_id varchar not null,
  stage varchar not null,
  sort_order integer not null default 0,
  status varchar not null default 'pending',
  started_at timestamp without time zone,
  finished_at timestamp without time zone,
  error text,
  progress_current integer,
  progress_total integer,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_job_stages_job_stage unique (job_id, stage),
  constraint ck_job_stages_stage check (stage in ('cleaned_text', 'complete', 'embeddings', 'formatted_text', 'mind_map_topics', 'promoting', 'question_cards', 'queued', 'study_cards', 'title', 'topic_knowledge_nodes')),
  constraint ck_job_stages_status check (status in ('cancelled', 'failed', 'pending', 'running', 'succeeded')),
  foreign key(job_id) references public.jobs (id) on delete cascade
);

create index if not exists ix_job_stages_job_id on public.job_stages (job_id);

create table if not exists public.job_logs (
  id varchar not null,
  job_id varchar not null,
  stage varchar,
  message text not null,
  metadata_json text,
  created_at timestamp without time zone,
  primary key (id),
  foreign key(job_id) references public.jobs (id) on delete cascade
);

create index if not exists ix_job_logs_job_id on public.job_logs (job_id);
create index if not exists ix_job_logs_created_at on public.job_logs (created_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_jobs_id_note_group_id'
  ) then
    alter table public.jobs
      add constraint uq_jobs_id_note_group_id unique (id, note_group_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_topic_chips_module_id_id'
  ) then
    alter table public.topic_chips
      add constraint uq_topic_chips_module_id_id unique (module_id, id);
  end if;
end $$;

create table if not exists public.note_group_generation_drafts (
  id varchar not null,
  job_id varchar not null,
  module_id varchar not null,
  note_group_id varchar not null,
  raw_text text not null,
  unique_id varchar,
  additional_generation_instructions text,
  title varchar,
  suggested_titles_json text,
  cleaned_text_markdown text,
  formatted_sections_json text,
  formatted_text text,
  current_stage varchar not null default 'queued',
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  unique (job_id),
  unique (note_group_id),
  constraint uq_note_group_generation_drafts_id_module_id unique (id, module_id),
  constraint ck_note_group_generation_drafts_current_stage check (current_stage in ('cleaned_text', 'complete', 'embeddings', 'formatted_text', 'mind_map_topics', 'promoting', 'question_cards', 'queued', 'study_cards', 'title', 'topic_knowledge_nodes')),
  foreign key(module_id) references public.modules (id) on delete cascade,
  foreign key(module_id, note_group_id) references public.note_groups (module_id, id) on delete cascade,
  foreign key(job_id, note_group_id) references public.jobs (id, note_group_id) on delete cascade
);

create index if not exists ix_note_group_generation_drafts_module_id on public.note_group_generation_drafts (module_id);
create unique index if not exists ix_note_group_generation_drafts_note_group_id on public.note_group_generation_drafts (note_group_id);

create table if not exists public.draft_study_cards (
  id varchar not null,
  draft_id varchar not null,
  title varchar,
  content text not null,
  embedding_json text,
  sort_order integer not null default 0,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_draft_study_cards_draft_id_id unique (draft_id, id),
  foreign key(draft_id) references public.note_group_generation_drafts (id) on delete cascade
);

create index if not exists ix_draft_study_cards_draft_id on public.draft_study_cards (draft_id);

create table if not exists public.draft_study_card_source_ranges (
  id varchar not null,
  draft_study_card_id varchar not null,
  start_index integer not null,
  end_index integer not null,
  created_at timestamp without time zone,
  primary key (id),
  foreign key(draft_study_card_id) references public.draft_study_cards (id) on delete cascade
);

create index if not exists ix_draft_study_card_source_ranges_draft_study_card_id on public.draft_study_card_source_ranges (draft_study_card_id);

create table if not exists public.draft_question_cards (
  id varchar not null,
  draft_id varchar not null,
  type varchar not null,
  prompt text not null,
  options_json text not null,
  correct_option_indices_json text not null,
  option_explanations_json text,
  study_card_refs_json text not null,
  sort_order integer not null default 0,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  foreign key(draft_id) references public.note_group_generation_drafts (id) on delete cascade
);

create index if not exists ix_draft_question_cards_draft_id on public.draft_question_cards (draft_id);

create table if not exists public.draft_topics (
  id varchar not null,
  draft_id varchar not null,
  module_id varchar not null,
  existing_topic_id varchar,
  relation_endpoint_id varchar,
  parent_draft_topic_id varchar,
  parent_existing_topic_id varchar,
  label varchar not null,
  description text,
  sort_order integer not null default 0,
  knowledge_node_status varchar not null default 'not_generated',
  knowledge_node_review_reason text,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_draft_topics_draft_id_id unique (draft_id, id),
  constraint uq_draft_topics_relation_endpoint unique (draft_id, relation_endpoint_id),
  constraint ck_draft_topics_at_most_one_parent check (parent_draft_topic_id is null or parent_existing_topic_id is null),
  constraint ck_draft_topics_existing_alias_has_no_relation_endpoint check (existing_topic_id is null or relation_endpoint_id is null),
  constraint ck_draft_topics_relation_endpoint_matches_id check (relation_endpoint_id is null or relation_endpoint_id = id),
  foreign key(draft_id, module_id) references public.note_group_generation_drafts (id, module_id) on delete cascade,
  foreign key(module_id, existing_topic_id) references public.topic_chips (module_id, id) on delete cascade,
  foreign key(draft_id, parent_draft_topic_id) references public.draft_topics (draft_id, id) on delete cascade,
  foreign key(module_id, parent_existing_topic_id) references public.topic_chips (module_id, id) on delete cascade
);

create index if not exists ix_draft_topics_draft_id on public.draft_topics (draft_id);
create index if not exists ix_draft_topics_module_id on public.draft_topics (module_id);

create table if not exists public.draft_knowledge_nodes (
  id varchar not null,
  draft_id varchar not null,
  module_id varchar not null,
  draft_topic_id varchar,
  existing_topic_id varchar,
  title varchar not null,
  summary text not null,
  knowledge_type varchar,
  importance varchar,
  source_quote text,
  sort_order integer not null default 0,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_draft_knowledge_nodes_draft_id_id unique (draft_id, id),
  constraint ck_draft_knowledge_nodes_exactly_one_topic check (((case when draft_topic_id is not null then 1 else 0 end + case when existing_topic_id is not null then 1 else 0 end)) = 1),
  foreign key(draft_id, module_id) references public.note_group_generation_drafts (id, module_id) on delete cascade,
  foreign key(draft_id, draft_topic_id) references public.draft_topics (draft_id, id) on delete cascade,
  foreign key(module_id, existing_topic_id) references public.topic_chips (module_id, id) on delete cascade
);

create index if not exists ix_draft_knowledge_nodes_draft_id on public.draft_knowledge_nodes (draft_id);
create index if not exists ix_draft_knowledge_nodes_module_id on public.draft_knowledge_nodes (module_id);
create index if not exists ix_draft_knowledge_nodes_draft_topic_id on public.draft_knowledge_nodes (draft_topic_id);
create index if not exists ix_draft_knowledge_nodes_existing_topic_id on public.draft_knowledge_nodes (existing_topic_id);

create table if not exists public.draft_note_group_topic_links (
  id varchar not null,
  draft_id varchar not null,
  module_id varchar not null,
  draft_topic_id varchar,
  existing_topic_id varchar,
  sort_order integer not null default 0,
  primary key (id),
  constraint ck_draft_note_group_topic_links_exactly_one_topic check (((case when draft_topic_id is not null then 1 else 0 end + case when existing_topic_id is not null then 1 else 0 end)) = 1),
  foreign key(draft_id, module_id) references public.note_group_generation_drafts (id, module_id) on delete cascade,
  foreign key(draft_id, draft_topic_id) references public.draft_topics (draft_id, id) on delete cascade,
  foreign key(module_id, existing_topic_id) references public.topic_chips (module_id, id) on delete cascade
);

create index if not exists ix_draft_note_group_topic_links_draft_id on public.draft_note_group_topic_links (draft_id);
create index if not exists ix_draft_note_group_topic_links_module_id on public.draft_note_group_topic_links (module_id);
create index if not exists ix_draft_note_group_topic_links_draft_topic_id on public.draft_note_group_topic_links (draft_topic_id);
create index if not exists ix_draft_note_group_topic_links_existing_topic_id on public.draft_note_group_topic_links (existing_topic_id);

create table if not exists public.draft_study_card_topic_links (
  id varchar not null,
  draft_id varchar not null,
  module_id varchar not null,
  draft_study_card_id varchar not null,
  draft_topic_id varchar,
  existing_topic_id varchar,
  role varchar not null default 'primary',
  primary key (id),
  constraint ck_draft_study_card_topic_links_exactly_one_topic check (((case when draft_topic_id is not null then 1 else 0 end + case when existing_topic_id is not null then 1 else 0 end)) = 1),
  foreign key(draft_id, module_id) references public.note_group_generation_drafts (id, module_id) on delete cascade,
  foreign key(draft_id, draft_study_card_id) references public.draft_study_cards (draft_id, id) on delete cascade,
  foreign key(draft_id, draft_topic_id) references public.draft_topics (draft_id, id) on delete cascade,
  foreign key(module_id, existing_topic_id) references public.topic_chips (module_id, id) on delete cascade
);

create index if not exists ix_draft_study_card_topic_links_draft_id on public.draft_study_card_topic_links (draft_id);
create index if not exists ix_draft_study_card_topic_links_module_id on public.draft_study_card_topic_links (module_id);
create index if not exists ix_draft_study_card_topic_links_draft_study_card_id on public.draft_study_card_topic_links (draft_study_card_id);
create index if not exists ix_draft_study_card_topic_links_draft_topic_id on public.draft_study_card_topic_links (draft_topic_id);
create index if not exists ix_draft_study_card_topic_links_existing_topic_id on public.draft_study_card_topic_links (existing_topic_id);

create table if not exists public.draft_study_card_knowledge_node_links (
  id varchar not null,
  draft_id varchar not null,
  draft_study_card_id varchar not null,
  draft_knowledge_node_id varchar not null,
  role varchar not null default 'primary',
  primary key (id),
  foreign key(draft_id) references public.note_group_generation_drafts (id) on delete cascade,
  foreign key(draft_id, draft_study_card_id) references public.draft_study_cards (draft_id, id) on delete cascade,
  foreign key(draft_id, draft_knowledge_node_id) references public.draft_knowledge_nodes (draft_id, id) on delete cascade
);

create index if not exists ix_draft_study_card_knowledge_node_links_draft_id on public.draft_study_card_knowledge_node_links (draft_id);
create index if not exists ix_draft_study_card_knowledge_node_links_draft_study_card_id on public.draft_study_card_knowledge_node_links (draft_study_card_id);
create index if not exists ix_draft_study_card_knowledge_node_links_draft_knowledge_node_id on public.draft_study_card_knowledge_node_links (draft_knowledge_node_id);

create table if not exists public.draft_mind_map_relations (
  id varchar not null,
  draft_id varchar not null,
  module_id varchar not null,
  source_draft_topic_id varchar,
  source_existing_topic_id varchar,
  source_draft_knowledge_node_id varchar,
  target_draft_topic_id varchar,
  target_existing_topic_id varchar,
  target_draft_knowledge_node_id varchar,
  relation_type varchar not null,
  label varchar,
  confidence double precision,
  sort_order integer not null default 0,
  created_at timestamp without time zone,
  primary key (id),
  constraint ck_draft_mind_map_relations_type check (relation_type in ('causes', 'contains', 'contrasts_with', 'defines', 'enables', 'example_of', 'part_of', 'related_to', 'requires', 'sequence')),
  constraint ck_draft_mind_map_relations_no_self_draft_topic check (source_draft_topic_id is null or target_draft_topic_id is null or source_draft_topic_id != target_draft_topic_id),
  constraint ck_draft_mind_map_relations_no_self_existing_topic check (source_existing_topic_id is null or target_existing_topic_id is null or source_existing_topic_id != target_existing_topic_id),
  constraint ck_draft_mind_map_relations_no_self_knowledge_node check (source_draft_knowledge_node_id is null or target_draft_knowledge_node_id is null or source_draft_knowledge_node_id != target_draft_knowledge_node_id),
  constraint ck_draft_mind_map_relations_exactly_one_source check (((case when source_draft_topic_id is not null then 1 else 0 end + case when source_existing_topic_id is not null then 1 else 0 end + case when source_draft_knowledge_node_id is not null then 1 else 0 end)) = 1),
  constraint ck_draft_mind_map_relations_exactly_one_target check (((case when target_draft_topic_id is not null then 1 else 0 end + case when target_existing_topic_id is not null then 1 else 0 end + case when target_draft_knowledge_node_id is not null then 1 else 0 end)) = 1),
  foreign key(draft_id, module_id) references public.note_group_generation_drafts (id, module_id) on delete cascade,
  foreign key(draft_id, source_draft_topic_id) references public.draft_topics (draft_id, relation_endpoint_id) on delete cascade,
  foreign key(module_id, source_existing_topic_id) references public.topic_chips (module_id, id) on delete cascade,
  foreign key(draft_id, source_draft_knowledge_node_id) references public.draft_knowledge_nodes (draft_id, id) on delete cascade,
  foreign key(draft_id, target_draft_topic_id) references public.draft_topics (draft_id, relation_endpoint_id) on delete cascade,
  foreign key(module_id, target_existing_topic_id) references public.topic_chips (module_id, id) on delete cascade,
  foreign key(draft_id, target_draft_knowledge_node_id) references public.draft_knowledge_nodes (draft_id, id) on delete cascade
);

create index if not exists ix_draft_mind_map_relations_draft_id on public.draft_mind_map_relations (draft_id);
create index if not exists ix_draft_mind_map_relations_module_id on public.draft_mind_map_relations (module_id);
create index if not exists ix_draft_mind_map_relations_source_draft_topic_id on public.draft_mind_map_relations (source_draft_topic_id);
create index if not exists ix_draft_mind_map_relations_source_existing_topic_id on public.draft_mind_map_relations (source_existing_topic_id);
create index if not exists ix_draft_mind_map_relations_source_draft_knowledge_node_id on public.draft_mind_map_relations (source_draft_knowledge_node_id);
create index if not exists ix_draft_mind_map_relations_target_draft_topic_id on public.draft_mind_map_relations (target_draft_topic_id);
create index if not exists ix_draft_mind_map_relations_target_existing_topic_id on public.draft_mind_map_relations (target_existing_topic_id);
create index if not exists ix_draft_mind_map_relations_target_draft_knowledge_node_id on public.draft_mind_map_relations (target_draft_knowledge_node_id);

alter table public.job_stages disable row level security;
alter table public.job_logs disable row level security;
alter table public.note_group_generation_drafts disable row level security;
alter table public.draft_study_cards disable row level security;
alter table public.draft_study_card_source_ranges disable row level security;
alter table public.draft_question_cards disable row level security;
alter table public.draft_topics disable row level security;
alter table public.draft_knowledge_nodes disable row level security;
alter table public.draft_note_group_topic_links disable row level security;
alter table public.draft_study_card_topic_links disable row level security;
alter table public.draft_study_card_knowledge_node_links disable row level security;
alter table public.draft_mind_map_relations disable row level security;
