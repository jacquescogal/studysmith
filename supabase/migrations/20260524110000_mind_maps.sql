alter table public.note_groups
  add column if not exists mind_map_status varchar not null default 'not_generated',
  add column if not exists mind_map_stale boolean not null default false,
  add column if not exists mind_map_generated_at timestamp without time zone;

create table if not exists public.mind_map_concepts (
  id varchar not null,
  module_id varchar not null,
  slug varchar not null,
  title varchar not null,
  summary text not null,
  concept_type varchar not null,
  importance varchar not null,
  source_quote text,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint uq_mind_map_concepts_module_slug unique (module_id, slug),
  constraint uq_mind_map_concepts_module_id unique (module_id, id),
  constraint ck_mind_map_concepts_type check (concept_type in ('topic', 'subtopic', 'term', 'process', 'principle', 'example')),
  constraint ck_mind_map_concepts_importance check (importance in ('core', 'supporting', 'detail')),
  foreign key(module_id) references public.modules (id) on delete cascade
);

create table if not exists public.mind_map_relations (
  id varchar not null,
  module_id varchar not null,
  source_concept_id varchar not null,
  target_concept_id varchar not null,
  relation_type varchar not null,
  label varchar,
  confidence double precision not null default 0,
  source_note_group_id varchar not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  primary key (id),
  constraint ck_mind_map_relations_not_self check (source_concept_id <> target_concept_id),
  constraint ck_mind_map_relations_type check (relation_type in ('contains', 'defines', 'part_of', 'requires', 'enables', 'causes', 'contrasts_with', 'example_of', 'sequence', 'related_to')),
  constraint uq_mind_map_relations_note_group_edge unique (module_id, source_concept_id, target_concept_id, relation_type, source_note_group_id),
  foreign key(module_id) references public.modules (id) on delete cascade,
  constraint fk_mind_map_relations_source_concept_module foreign key(module_id, source_concept_id) references public.mind_map_concepts (module_id, id) on delete cascade,
  constraint fk_mind_map_relations_target_concept_module foreign key(module_id, target_concept_id) references public.mind_map_concepts (module_id, id) on delete cascade,
  foreign key(source_concept_id) references public.mind_map_concepts (id) on delete cascade,
  foreign key(target_concept_id) references public.mind_map_concepts (id) on delete cascade,
  foreign key(source_note_group_id) references public.note_groups (id) on delete cascade
);

create table if not exists public.study_card_mind_map_concepts (
  study_card_id varchar not null,
  concept_id varchar not null,
  role varchar not null,
  created_at timestamp without time zone,
  primary key (study_card_id, concept_id),
  constraint ck_study_card_mind_map_concepts_role check (role in ('primary', 'supporting')),
  foreign key(study_card_id) references public.study_cards (id) on delete cascade,
  foreign key(concept_id) references public.mind_map_concepts (id) on delete cascade
);

create table if not exists public.note_group_mind_map_concepts (
  note_group_id varchar not null,
  concept_id varchar not null,
  created_at timestamp without time zone,
  primary key (note_group_id, concept_id),
  foreign key(note_group_id) references public.note_groups (id) on delete cascade,
  foreign key(concept_id) references public.mind_map_concepts (id) on delete cascade
);

create index if not exists ix_mind_map_concepts_module_id on public.mind_map_concepts (module_id);
create index if not exists ix_mind_map_relations_module_id on public.mind_map_relations (module_id);
create index if not exists ix_mind_map_relations_source_concept_id on public.mind_map_relations (source_concept_id);
create index if not exists ix_mind_map_relations_target_concept_id on public.mind_map_relations (target_concept_id);
create index if not exists ix_mind_map_relations_source_note_group_id on public.mind_map_relations (source_note_group_id);
create index if not exists ix_mind_map_relations_module_source_concept_id on public.mind_map_relations (module_id, source_concept_id);
create index if not exists ix_mind_map_relations_module_target_concept_id on public.mind_map_relations (module_id, target_concept_id);
create index if not exists ix_study_card_mind_map_concepts_concept_id on public.study_card_mind_map_concepts (concept_id);
create index if not exists ix_note_group_mind_map_concepts_concept_id on public.note_group_mind_map_concepts (concept_id);

alter table public.mind_map_concepts disable row level security;
alter table public.mind_map_relations disable row level security;
alter table public.study_card_mind_map_concepts disable row level security;
alter table public.note_group_mind_map_concepts disable row level security;
