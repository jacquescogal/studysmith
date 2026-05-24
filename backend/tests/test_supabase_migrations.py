from pathlib import Path

from app.db import Base
from app import models  # noqa: F401


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def _migration_sql() -> str:
    return "\n".join(path.read_text() for path in sorted(MIGRATIONS_DIR.glob("*.sql")))


def test_baseline_migration_creates_all_model_tables():
    sql = _migration_sql().lower()

    for table_name in sorted(Base.metadata.tables):
        assert (
            f"create table public.{table_name}" in sql
            or f"create table if not exists public.{table_name}" in sql
        )


def test_baseline_migration_installs_vector_and_disables_rls_for_app_tables():
    sql = _migration_sql().lower()

    assert "create extension if not exists vector" in sql
    assert "enable row level security" not in sql
    for table_name in sorted(Base.metadata.tables):
        assert f"alter table public.{table_name} disable row level security" in sql


def test_subject_access_migration_uses_reader_maintainer_owner_roles():
    sql = _migration_sql().lower()

    assert "check (access_level in ('maintainer', 'owner', 'reader'))" in sql
    assert "when 'read' then 'reader'" in sql
    assert "when 'edit' then 'maintainer'" in sql
    assert "uq_subject_access_single_owner" in sql


def test_mind_map_generation_jobs_have_active_uniqueness_migration():
    sql = _migration_sql().lower()

    assert "uq_jobs_active_mind_map_generation_note_group" in sql
    assert "on public.jobs (note_group_id)" in sql
    assert "type = 'mind_map_generation'" in sql
    assert "status in ('queued', 'running')" in sql


def test_mind_map_migration_repairs_existing_join_tables_with_module_id():
    sql = _migration_sql().lower()

    assert "alter table public.note_group_mind_map_concepts add column if not exists module_id varchar" in sql
    assert "alter table public.study_card_mind_map_concepts add column if not exists note_group_id varchar" in sql
    assert "alter table public.study_card_mind_map_concepts add column if not exists module_id varchar" in sql
    assert "alter table public.mind_map_relations add column if not exists module_id varchar" in sql
    assert "update public.note_group_mind_map_concepts ngmmc" in sql
    assert "update public.study_card_mind_map_concepts scmmc\nset note_group_id = study_cards.note_group_id" in sql
    assert "update public.study_card_mind_map_concepts scmmc" in sql
    assert "update public.mind_map_relations mmr" in sql
    assert "alter table public.mind_map_concepts\n      add constraint uq_mind_map_concepts_module_id" in sql
    assert "alter table public.note_groups\n      add constraint uq_note_groups_module_id_id" in sql
    assert "alter table public.study_cards\n      add constraint uq_study_cards_note_group_id_id" in sql


def test_topic_tree_migration_adds_single_parent_lineage():
    sql = _migration_sql().lower()

    assert "add column if not exists parent_topic_id varchar" in sql
    assert "add column if not exists sort_order integer not null default 0" in sql
    assert "constraint fk_topic_chips_parent_topic" in sql
    assert "references public.topic_chips (id)" in sql
    assert "on delete set null" in sql
    assert "ix_topic_chips_module_parent_topic_id" in sql
