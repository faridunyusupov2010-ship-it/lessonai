from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import engine, get_db
from .models import Base
from .routers import admin, auth, bank, books, public, reports, results, tests


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="LessonAI API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(tests.router)
app.include_router(public.router)
app.include_router(results.router)
app.include_router(bank.router)
app.include_router(books.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/ping")
def ping() -> dict[str, str]:
    """Бе база: барои назорати вақти кор (uptime) ва бедор нигоҳ доштани сервер."""
    return {"status": "ok"}


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
