"""Схемаи база барои LessonAI (AI ёвари омӯзгорони забони англисӣ).

Ғояҳои асосӣ:
- Question мустақил аз Test нигоҳ дошта мешавад ва ба омӯзгор тааллуқ дорад.
  Ин "банки саволҳо"-ро бе ҷадвали алоҳида имконпазир мекунад: як савол
  метавонад дар якчанд тест истифода шавад (ҷадвали TestQuestion).
- Гузориши "хонанда дар кадом мавзӯъ заиф аст" дар ҷадвал нигоҳ дошта
  намешавад; он аз AttemptAnswer + Question.topic_tag ҳисоб карда мешавад.
- TextbookUnit танҳо номи китоб, Unit ва рӯйхати мавзӯъҳоро нигоҳ медорад,
  на мазмуни китобро (ҳуқуқи муаллиф).
"""

import enum
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_share_token() -> str:
    return secrets.token_urlsafe(8)


class Base(DeclarativeBase):
    pass


# ----------------------------- Enums -----------------------------


class UILanguage(str, enum.Enum):
    tg = "tg"
    ru = "ru"
    en = "en"


class Plan(str, enum.Enum):
    free = "free"
    pro = "pro"


class CEFRLevel(str, enum.Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    fill_blank = "fill_blank"
    true_false = "true_false"


class TestStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


# ----------------------------- Users -----------------------------


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    ui_language: Mapped[UILanguage] = mapped_column(
        Enum(UILanguage), default=UILanguage.tg
    )
    plan: Mapped[Plan] = mapped_column(Enum(Plan), default=Plan.free)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    students: Mapped[list["Student"]] = relationship(back_populates="teacher")
    tests: Mapped[list["Test"]] = relationship(back_populates="teacher")
    questions: Mapped[list["Question"]] = relationship(back_populates="teacher")


class Student(Base):
    """Хонандаи омӯзгор. Бе ворид шудан (login): хонанда тавассути истиноди тест
    ном ворид мекунад, ва омӯзгор метавонад ӯро бо Student пайваст кунад."""

    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(255))
    level: Mapped[CEFRLevel | None] = mapped_column(Enum(CEFRLevel), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    teacher: Mapped[Teacher] = relationship(back_populates="students")
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="student")


# --------------------------- Textbooks ---------------------------


class Textbook(Base):
    __tablename__ = "textbooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))  # масалан "Headway"
    edition_level: Mapped[str] = mapped_column(String(100))  # "Intermediate"
    cefr_level: Mapped[CEFRLevel | None] = mapped_column(Enum(CEFRLevel), nullable=True)

    units: Mapped[list["TextbookUnit"]] = relationship(
        back_populates="textbook", order_by="TextbookUnit.number"
    )

    __table_args__ = (UniqueConstraint("title", "edition_level"),)


class TextbookUnit(Base):
    __tablename__ = "textbook_units"

    id: Mapped[int] = mapped_column(primary_key=True)
    textbook_id: Mapped[int] = mapped_column(
        ForeignKey("textbooks.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    # Рӯйхати мавзӯъҳои грамматика/луғат, масалан ["Past Simple", "Irregular verbs"]
    topics: Mapped[list[str]] = mapped_column(JSON, default=list)

    textbook: Mapped[Textbook] = relationship(back_populates="units")

    __table_args__ = (UniqueConstraint("textbook_id", "number"),)


# ---------------------- Questions and Tests ----------------------


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType))
    level: Mapped[CEFRLevel] = mapped_column(Enum(CEFRLevel), index=True)
    # Мавзӯи грамматика/луғат; барои гузориши заифии хонанда истифода мешавад
    topic_tag: Mapped[str] = mapped_column(String(255), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    # multiple_choice: ["a", "b", "c", "d"]; true_false: null; fill_blank: null
    options: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # multiple_choice: индекс (int); true_false: bool;
    # fill_blank: рӯйхати ҷавобҳои қобили қабул, масалан ["has gone", "'s gone"]
    correct_answer: Mapped[object] = mapped_column(JSON)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Агар True, савол дар "банки саволҳо"-и омӯзгор намоён аст
    in_bank: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    teacher: Mapped[Teacher] = relationship(back_populates="questions")


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    topic: Mapped[str] = mapped_column(String(255))
    level: Mapped[CEFRLevel] = mapped_column(Enum(CEFRLevel))
    textbook_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("textbook_units.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[TestStatus] = mapped_column(
        Enum(TestStatus), default=TestStatus.draft, index=True
    )
    # Барои истиноди хонанда: /t/<share_token>
    share_token: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, default=new_share_token
    )
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    teacher: Mapped[Teacher] = relationship(back_populates="tests")
    textbook_unit: Mapped[TextbookUnit | None] = relationship()
    test_questions: Mapped[list["TestQuestion"]] = relationship(
        back_populates="test",
        order_by="TestQuestion.position",
        cascade="all, delete-orphan",
    )
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="test")


class TestQuestion(Base):
    """Пайвасти Test ва Question (тартиб ва холи ҳар савол дар ин тест)."""

    __tablename__ = "test_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tests.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    points: Mapped[float] = mapped_column(Float, default=1.0)

    test: Mapped[Test] = relationship(back_populates="test_questions")
    question: Mapped[Question] = relationship()

    __table_args__ = (
        UniqueConstraint("test_id", "question_id"),
        UniqueConstraint("test_id", "position"),
    )


# ------------------------ Attempts / Results ------------------------


class Attempt(Base):
    """Як маротиба супоридани тест аз ҷониби хонанда."""

    __tablename__ = "attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    test_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tests.id", ondelete="CASCADE"), index=True
    )
    # Ихтиёрӣ: агар омӯзгор хонандаро пайваст карда бошад
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Номе, ки хонанда дар истинод ворид кардааст
    student_name: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    test: Mapped[Test] = relationship(back_populates="attempts")
    student: Mapped[Student | None] = relationship(back_populates="attempts")
    answers: Mapped[list["AttemptAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    # Ҷавоби хонанда: int (индекс), bool ё str, мувофиқи намуди савол
    response: Mapped[object | None] = mapped_column(JSON, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    points_awarded: Mapped[float] = mapped_column(Float, default=0.0)

    attempt: Mapped[Attempt] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship()

    __table_args__ = (UniqueConstraint("attempt_id", "question_id"),)
