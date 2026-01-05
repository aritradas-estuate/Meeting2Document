"""
Centralized configuration management.
All settings are loaded from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "MeetingsToDocument"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    frontend_url: str = "http://localhost:5173"

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/meetingstodoc"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    # AI API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_ai_api_key: str = ""
    assemblyai_api_key: str = ""

    # AI Models (configurable)
    model_video_analysis: str = "gemini-3-flash"
    model_transcription: str = "best"
    model_extraction: str = "gpt-5.2"
    model_synthesis: str = "gpt-5.2"
    model_section_writer: str = "gpt-5.2"
    model_section_reviewer: str = "claude-3-5-sonnet-20241022"

    # Processing
    max_review_loops: int = 3
    default_document_schema: str = "zuora_q2r"
    transcription_timeout: int = 600
    video_analysis_timeout: int = 300
    synthesis_timeout: int = 120
    section_generation_timeout: int = 60

    # File Storage
    temp_file_dir: str = "/tmp/meetingstodoc"
    max_file_size_mb: int = 100

    # Security
    secret_key: str = "change-this-in-production-use-a-secure-random-key"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Monitoring
    sentry_dsn: Optional[str] = None

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.app_env.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.app_env.lower() == "development"

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
