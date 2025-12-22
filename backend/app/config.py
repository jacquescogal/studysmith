import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value else default


def _resolve_path(path_value: str) -> str:
    path = Path(path_value)
    if path.is_absolute():
        return str(path)
    return str((BASE_DIR / path).resolve())


class Settings:
    openai_api_key = _get_env("OPENAI_API_KEY", "")
    openai_model = _get_env("OPENAI_MODEL", "gpt-4o-mini")
    openai_embedding_model = _get_env("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    database_url = _get_env("DATABASE_URL", "sqlite:///./study.db")
    chroma_path = _resolve_path(_get_env("CHROMA_PATH", "./chroma"))


settings = Settings()
