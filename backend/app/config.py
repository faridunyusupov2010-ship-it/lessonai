from dataclasses import dataclass
from urllib.parse import urlparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str
    api_key: str
    model: str


def _label(base_url: str) -> str:
    host = urlparse(base_url).netloc.lower()
    for key, label in (("groq", "groq"), ("openrouter", "openrouter"), ("googleapis", "gemini")):
        if key in host:
            return label
    return host or "llm"


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
    # Провайдерҳои эҳтиётӣ (вақте лимити аввалӣ тамом шавад, ба онҳо мегузарем)
    llm2_base_url: str = ""
    llm2_api_key: str = ""
    llm2_model: str = ""
    llm3_base_url: str = ""
    llm3_api_key: str = ""
    llm3_model: str = ""
    llm4_base_url: str = ""
    llm4_api_key: str = ""
    llm4_model: str = ""

    def providers(self) -> list[Provider]:
        """Рӯйхати провайдерҳо аз рӯи афзалият. Танҳо онҳое, ки ҳар се қиматро доранд."""
        raw = [
            (self.llm_base_url, self.llm_api_key, self.llm_model),
            (self.llm2_base_url, self.llm2_api_key, self.llm2_model),
            (self.llm3_base_url, self.llm3_api_key, self.llm3_model),
            (self.llm4_base_url, self.llm4_api_key, self.llm4_model),
        ]
        out: list[Provider] = []
        seen: dict[str, int] = {}
        for base, key, model in raw:
            if not (base.strip() and key.strip() and model.strip()):
                continue
            label = _label(base)
            seen[label] = seen.get(label, 0) + 1
            name = label if seen[label] == 1 else f"{label}-{seen[label]}"
            out.append(Provider(name, base.strip(), key.strip(), model.strip()))
        return out

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Neon ва дигар провайдерҳо "postgresql://..." медиҳанд; мо драйвери psycopg3 истифода мебарем
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v


settings = Settings()
