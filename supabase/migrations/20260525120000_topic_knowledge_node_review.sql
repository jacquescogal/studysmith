alter table public.topic_chips
  add column if not exists knowledge_node_status varchar not null default 'not_generated',
  add column if not exists knowledge_node_review_reason text;

alter table public.topic_chips
  add constraint ck_topic_chips_knowledge_node_status
  check (knowledge_node_status in ('not_generated', 'complete', 'needs_review'));

create index if not exists ix_topic_chips_module_knowledge_node_status
  on public.topic_chips (module_id, knowledge_node_status);
