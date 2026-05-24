alter table public.mind_map_concepts
  add column if not exists topic_id varchar,
  add column if not exists knowledge_type varchar;

update public.mind_map_concepts
set knowledge_type = case
  when concept_type = 'process' then 'mechanism'
  when concept_type = 'principle' then 'rule'
  else 'definition'
end
where knowledge_type is null;

alter table public.mind_map_concepts
  add constraint fk_mind_map_concepts_topic
  foreign key (topic_id)
  references public.topic_chips (id)
  on delete set null;

alter table public.mind_map_concepts
  add constraint ck_mind_map_concepts_knowledge_type
  check (knowledge_type in ('definition', 'fact', 'mechanism', 'rule'));

create index if not exists ix_mind_map_concepts_topic_id
  on public.mind_map_concepts (topic_id);

create index if not exists ix_mind_map_concepts_module_topic_id
  on public.mind_map_concepts (module_id, topic_id);
