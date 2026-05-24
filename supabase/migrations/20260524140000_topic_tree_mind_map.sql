alter table public.topic_chips
  add column if not exists parent_topic_id varchar,
  add column if not exists sort_order integer not null default 0;

alter table public.topic_chips
  add constraint fk_topic_chips_parent_topic
  foreign key (parent_topic_id)
  references public.topic_chips (id)
  on delete set null;

create index if not exists ix_topic_chips_parent_topic_id
  on public.topic_chips (parent_topic_id);

create index if not exists ix_topic_chips_module_parent_topic_id
  on public.topic_chips (module_id, parent_topic_id);
