from pathlib import Path

from app.db import Base
from app import models  # noqa: F401


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def _migration_sql() -> str:
    return "\n".join(path.read_text() for path in sorted(MIGRATIONS_DIR.glob("*.sql")))


def test_baseline_migration_creates_all_model_tables():
    sql = _migration_sql()

    for table_name in sorted(Base.metadata.tables):
        assert f"create table public.{table_name}" in sql.lower()


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
