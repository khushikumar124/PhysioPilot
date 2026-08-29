"""SQLAlchemy engine / session wiring."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def ensure_schema() -> None:
    """Add columns that were introduced after a database was first created.

    The prototype uses `create_all` rather than a migration tool, and that only
    creates missing *tables* - it will not alter an existing one. Without this,
    anyone with a database from an earlier build gets a confusing "no such
    column" error instead of the new feature. Each entry is idempotent.
    """
    from sqlalchemy import inspect, text

    additions = {
        "exercises": {
            "created_by_therapist_id": "INTEGER REFERENCES physiotherapist_profiles(id)",
        },
    }

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        for table, columns in additions.items():
            if table not in existing_tables:
                continue  # create_all will build it with every column present
            present = {col["name"] for col in inspector.get_columns(table)}
            for column, definition in columns.items():
                if column not in present:
                    connection.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                    )


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
