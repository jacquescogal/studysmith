alter table public.note_group_mind_map_concepts add column if not exists module_id varchar;
alter table public.study_card_mind_map_concepts add column if not exists note_group_id varchar;
alter table public.study_card_mind_map_concepts add column if not exists module_id varchar;
alter table public.mind_map_relations add column if not exists module_id varchar;

update public.note_group_mind_map_concepts ngmmc
set module_id = note_groups.module_id
from public.note_groups
where ngmmc.note_group_id = note_groups.id
  and ngmmc.module_id is null;

update public.study_card_mind_map_concepts scmmc
set note_group_id = study_cards.note_group_id
from public.study_cards
where scmmc.study_card_id = study_cards.id
  and scmmc.note_group_id is null;

update public.study_card_mind_map_concepts scmmc
set module_id = note_groups.module_id
from public.note_groups
where scmmc.note_group_id = note_groups.id
  and scmmc.module_id is null;

update public.mind_map_relations mmr
set module_id = note_groups.module_id
from public.note_groups
where mmr.source_note_group_id = note_groups.id
  and mmr.module_id is null;

delete from public.note_group_mind_map_concepts
where module_id is null;

delete from public.study_card_mind_map_concepts
where module_id is null
   or note_group_id is null;

delete from public.mind_map_relations
where module_id is null;

alter table public.note_group_mind_map_concepts alter column module_id set not null;
alter table public.study_card_mind_map_concepts alter column note_group_id set not null;
alter table public.study_card_mind_map_concepts alter column module_id set not null;
alter table public.mind_map_relations alter column module_id set not null;

create index if not exists ix_mind_map_relations_module_id on public.mind_map_relations (module_id);
create index if not exists ix_mind_map_relations_module_source_concept_id on public.mind_map_relations (module_id, source_concept_id);
create index if not exists ix_mind_map_relations_module_target_concept_id on public.mind_map_relations (module_id, target_concept_id);
create index if not exists ix_mind_map_relations_module_source_note_group_id on public.mind_map_relations (module_id, source_note_group_id);
create index if not exists ix_study_card_mind_map_concepts_module_id on public.study_card_mind_map_concepts (module_id);
create index if not exists ix_study_card_mind_map_concepts_module_concept_id on public.study_card_mind_map_concepts (module_id, concept_id);
create index if not exists ix_study_card_mind_map_concepts_module_note_group_id on public.study_card_mind_map_concepts (module_id, note_group_id);
create index if not exists ix_note_group_mind_map_concepts_module_id on public.note_group_mind_map_concepts (module_id);
create index if not exists ix_note_group_mind_map_concepts_module_note_group_id on public.note_group_mind_map_concepts (module_id, note_group_id);
create index if not exists ix_note_group_mind_map_concepts_module_concept_id on public.note_group_mind_map_concepts (module_id, concept_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_mind_map_concepts_module_id'
  ) then
    alter table public.mind_map_concepts
      add constraint uq_mind_map_concepts_module_id
      unique (module_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_note_groups_module_id_id'
  ) then
    alter table public.note_groups
      add constraint uq_note_groups_module_id_id
      unique (module_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_study_cards_note_group_id_id'
  ) then
    alter table public.study_cards
      add constraint uq_study_cards_note_group_id_id
      unique (note_group_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_mind_map_relations_source_concept_module'
  ) then
    alter table public.mind_map_relations
      add constraint fk_mind_map_relations_source_concept_module
      foreign key(module_id, source_concept_id)
      references public.mind_map_concepts (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_mind_map_relations_target_concept_module'
  ) then
    alter table public.mind_map_relations
      add constraint fk_mind_map_relations_target_concept_module
      foreign key(module_id, target_concept_id)
      references public.mind_map_concepts (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_mind_map_relations_source_note_group_module'
  ) then
    alter table public.mind_map_relations
      add constraint fk_mind_map_relations_source_note_group_module
      foreign key(module_id, source_note_group_id)
      references public.note_groups (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_study_card_mind_map_concepts_concept_module'
  ) then
    alter table public.study_card_mind_map_concepts
      add constraint fk_study_card_mind_map_concepts_concept_module
      foreign key(module_id, concept_id)
      references public.mind_map_concepts (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_study_card_mind_map_concepts_note_group_module'
  ) then
    alter table public.study_card_mind_map_concepts
      add constraint fk_study_card_mind_map_concepts_note_group_module
      foreign key(module_id, note_group_id)
      references public.note_groups (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_note_group_mind_map_concepts_note_group_module'
  ) then
    alter table public.note_group_mind_map_concepts
      add constraint fk_note_group_mind_map_concepts_note_group_module
      foreign key(module_id, note_group_id)
      references public.note_groups (module_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_note_group_mind_map_concepts_concept_module'
  ) then
    alter table public.note_group_mind_map_concepts
      add constraint fk_note_group_mind_map_concepts_concept_module
      foreign key(module_id, concept_id)
      references public.mind_map_concepts (module_id, id)
      on delete cascade;
  end if;
end $$;
