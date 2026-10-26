from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://lessonai:lessonai@localhost:5432/lessonai"
    secret_key: str = "dev-only-change-me"
    cors_origins: list[str] = ["http://localhost:3000"]
    # Дар dev ҷадвалҳо худкор сохта мешаванд. Дар production аз Alembic истифода баред.
    auto_create_tables: bool = True
    # Почтаҳои админ, масалан ADMIN_EMAILS=["me@example.com"]
    admin_emails: list[str] = []

    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = ""

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Neon ва дигар провайдерҳо "postgresql://..." медиҳанд; мо драйвери psycopg3 истифода мебарем
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v


settings = Settings()
