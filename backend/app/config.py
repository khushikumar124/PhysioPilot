"""Application configuration, loaded from environment / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PHYSIOPILOT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PhysioPilot API"
    # Dev default only. Production must supply PHYSIOPILOT_SECRET_KEY.
    secret_key: str = "dev-only-insecure-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    database_url: str = "sqlite:///./physiopilot.db"
    # Seed the demo clinic on startup when the database has no users yet.
    # Intended for a fresh demo deployment; it never overwrites existing data.
    seed_demo_on_startup: bool = False
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Optional LLM backing for the assistant. Empty => deterministic fallback.
    anthropic_api_key: str = ""
    assistant_model: str = "claude-sonnet-5"

    @property
    def sqlalchemy_url(self) -> str:
        """The database URL in the form SQLAlchemy expects.

        Managed Postgres providers hand out `postgres://...`, which SQLAlchemy
        2.x no longer recognises, and they do not name a driver. Rewriting it
        here means the platform's variable can be pasted in untouched.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
