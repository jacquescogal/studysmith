import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value else default


def _get_csv_set(name: str) -> set[str]:
    value = os.getenv(name, "")
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def _normalize_database_url(value: str) -> str:
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    return value


class Settings:
    openai_api_key = _get_env("OPENAI_API_KEY", "")
    openai_weak_model = _get_env("OPENAI_WEAK_MODEL", "gpt-5.4-mini")
    openai_strong_model = _get_env("OPENAI_STRONG_MODEL", "gpt-5.4")
    openai_embedding_model = _get_env("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    embedding_dimension = int(_get_env("EMBEDDING_DIMENSION", "1536"))
    database_url = _normalize_database_url(_get_env("DATABASE_URL", "sqlite:///./study.db"))
    supabase_url = _get_env("SUPABASE_URL", "")
    supabase_jwks_url = _get_env("SUPABASE_JWKS_URL", "")
    supabase_jwt_issuer = _get_env("SUPABASE_JWT_ISSUER", "")
    supabase_jwt_audience = _get_env("SUPABASE_JWT_AUDIENCE", "authenticated")
    admin_emails = _get_csv_set("ADMIN_EMAILS")


settings = Settings()
