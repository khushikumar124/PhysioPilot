"""SQLAlchemy engine / session wiring."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")

_connect_args = {"check_same_thread": False} if _is_sqlite else {}

if _is_sqlite:
    _engine_kwargs: dict = {}
elif settings.is_serverless:
    # Serverless invocations are short-lived and many run at once. Holding a
    # pool per instance exhausts a small Postgres connection limit quickly, so
    # each request opens and closes its own connection and the provider's
    # pooled connection string does the real pooling.
    from sqlalchemy.pool import NullPool

    _engine_kwargs = {"poolclass": NullPool}
else:
    # A hosted database drops idle connections; pre-ping so a stale one is
    # replaced rather than failing the first request after a quiet spell.
    _engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 300}

engine = create_engine(
    settings.sqlalchemy_url, connect_args=_connect_args, future=True, **_engine_kwargs
)
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
