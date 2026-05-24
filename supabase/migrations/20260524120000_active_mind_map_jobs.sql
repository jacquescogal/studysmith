with ranked_active_mind_map_jobs as (
  select
    id,
    row_number() over (
      partition by note_group_id
      order by created_at desc nulls last, id desc
    ) as active_rank
  from public.jobs
  where note_group_id is not null
    and type = 'MIND_MAP_GENERATION'
    and status in ('queued', 'running')
)
update public.jobs
set
  status = 'failed',
  error = coalesce(error, 'Superseded by active Concept Mind Map generation job'),
  updated_at = now()
from ranked_active_mind_map_jobs
where public.jobs.id = ranked_active_mind_map_jobs.id
  and ranked_active_mind_map_jobs.active_rank > 1;

create unique index if not exists uq_jobs_active_mind_map_generation_note_group
  on public.jobs (note_group_id)
  where note_group_id is not null
    and type = 'MIND_MAP_GENERATION'
    and status in ('queued', 'running');
