"""Application settings, read from environment variables (see ../.env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://groove:groove@localhost:5432/groove"
    # Public URL of the app. Its scheme decides whether the session cookie is marked Secure.
    public_base_url: str = "http://localhost:8080"

    # Swagger UI and /api/openapi.json; docker-compose turns them off unless API_DOCS_ENABLED=true.
    api_docs_enabled: bool = True

    covers_dir: str = "covers"  # where cover images are stored (a volume in Docker)
    max_cover_bytes: int = 5 * 1024 * 1024
    cover_size: int = 600
    undo_seconds: int = 10

    session_days: int = 30
    invite_days: int = 7
    reset_hours: int = 24
    min_password_length: int = 10
    login_max_failures: int = 5
    login_window_minutes: int = 10
    housekeeping_seconds: float = 3600

    # Discogs (application credentials stay on the server)
    fernet_key: str = ""
    discogs_consumer_key: str = ""
    discogs_consumer_secret: str = ""
    discogs_api_url: str = "https://api.discogs.com"
    discogs_web_url: str = "https://www.discogs.com"
    discogs_user_agent: str = "Groove/0.1 +https://localhost"
    discogs_rate_per_minute: int = 55
    discogs_max_retries: int = 4
    discogs_backoff_seconds: float = 2.0
    import_page_size: int = 100
    import_worker_enabled: bool = True
    import_poll_seconds: float = 2.0

    @property
    def discogs_configured(self) -> bool:
        # The encryption key is needed to store member tokens, so it counts as configuration.
        return bool(self.discogs_consumer_key and self.discogs_consumer_secret and self.fernet_key)

    @property
    def cookie_secure(self) -> bool:
        return self.public_base_url.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
