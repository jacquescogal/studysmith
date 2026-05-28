from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


def _connect_args_for_database_url(database_url: str) -> dict:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False, "timeout": 30}
    if database_url.startswith("postgresql+psycopg"):
        return {"prepare_threshold": None}
    return {}


connect_args = _connect_args_for_database_url(settings.database_url)
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
