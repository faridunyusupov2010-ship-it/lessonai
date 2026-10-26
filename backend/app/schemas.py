import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import CEFRLevel, Plan, QuestionType, TestStatus, UILanguage

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


# ------------------------------ Auth ------------------------------


class RegisterIn(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    ui_language: UILanguage = UILanguage.tg


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    ui_language: UILanguage
    plan: Plan
    is_admin: bool = False


class ProfileUpdate(BaseModel):
    ui_language: UILanguage | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    teacher: TeacherOut


# ----------------------------- Questions -----------------------------


class QuestionBase(BaseModel):
    type: QuestionType
    topic_tag: str = Field(min_length=1, max_length=255)
    prompt: str = Field(min_length=1)
    options: list[str] | None = None
    correct_answer: int | bool | list[str]
    explanation: str | None = None

    @model_validator(mode="after")
    def _check_consistency(self):
        ca = self.correct_answer
        if self.type == QuestionType.multiple_choice:
            if not self.options or not 2 <= len(self.options) <= 6:
                raise ValueError("multiple_choice needs 2-6 options")
            if type(ca) is not int or not 0 <= ca < len(self.options):
                raise ValueError("correct_answer must be a valid option index")
        elif self.type == QuestionType.true_false:
            if type(ca) is not bool:
                raise ValueError("true_false correct_answer must be true or false")
            self.options = None
        else:  # fill_blank
            if not isinstance(ca, list) or not ca or not all(
                isinstance(a, str) and a.strip() for a in ca
            ):
                raise ValueError("fill_blank needs a non-empty list of accepted answers")
            self.options = None
        return self


class QuestionOut(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    level: CEFRLevel
    in_bank: bool


# ------------------------------- Tests -------------------------------


class GenerateIn(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    level: CEFRLevel
    types: list[QuestionType] = Field(default=[QuestionType.multiple_choice], min_length=1)
    count: int = Field(default=10, ge=1, le=30)
    title: str | None = Field(default=None, max_length=255)
    book_unit_id: int | None = None


class TestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: TestStatus | None = None
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)


class TestSummary(BaseModel):
    id: uuid.UUID
    title: str
    topic: str
    level: CEFRLevel
    status: TestStatus
    share_token: str
    created_at: datetime
    question_count: int


class TestOut(BaseModel):
    id: uuid.UUID
    title: str
    topic: str
    level: CEFRLevel
    status: TestStatus
    share_token: str
    time_limit_minutes: int | None
    created_at: datetime
    questions: list[QuestionOut]


# ------------------------ Student / Results ------------------------


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    response: int | bool | str | None = None


class SubmitIn(BaseModel):
    student_name: str = Field(min_length=1, max_length=100)
    answers: list[AnswerIn] = Field(max_length=100)


class PublicQuestion(BaseModel):
    id: uuid.UUID
    type: QuestionType
    prompt: str
    options: list[str] | None


class PublicTest(BaseModel):
    title: str
    topic: str
    level: CEFRLevel
    time_limit_minutes: int | None
    questions: list[PublicQuestion]


class QuestionResult(BaseModel):
    question_id: uuid.UUID
    type: QuestionType
    prompt: str
    options: list[str] | None
    response: int | bool | str | None
    is_correct: bool
    correct_answer: int | bool | list[str]
    explanation: str | None
    points_awarded: float
    points: float


class SubmitOut(BaseModel):
    attempt_id: uuid.UUID
    score: float
    max_score: float
    results: list[QuestionResult]


class AttemptSummary(BaseModel):
    id: uuid.UUID
    student_name: str
    submitted_at: datetime | None
    score: float | None
    max_score: float | None


class QuestionStat(BaseModel):
    question_id: uuid.UUID
    position: int
    prompt: str
    topic_tag: str
    correct: int
    total: int


class TestResults(BaseModel):
    title: str
    attempts: list[AttemptSummary]
    questions: list[QuestionStat]
    average_percent: float | None


class AttemptDetail(BaseModel):
    id: uuid.UUID
    student_name: str
    submitted_at: datetime | None
    score: float | None
    max_score: float | None
    results: list[QuestionResult]


# ----------------------- Bank / Books / Reports -----------------------


class BankToggleIn(BaseModel):
    in_bank: bool


class AddQuestionsIn(BaseModel):
    question_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)


class CreateTestIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    topic: str = Field(min_length=1, max_length=200)
    level: CEFRLevel


class BookUnitOut(BaseModel):
    id: int
    label: str
    topics: list[str]


class BookOut(BaseModel):
    book: str
    units: list[BookUnitOut]


class BulkUnitsIn(BaseModel):
    book: str = Field(min_length=1, max_length=255)
    text: str = Field(min_length=1, max_length=10_000)


class StudentSummary(BaseModel):
    name: str
    attempts: int
    percent: float | None
    last_at: datetime | None


class TopicStat(BaseModel):
    topic: str
    correct: int
    total: int
    percent: float


# ------------------------------ Admin ------------------------------


class AdminStats(BaseModel):
    teachers: int
    pro_teachers: int
    new_teachers_7d: int
    tests: int
    tests_today: int
    attempts: int


class AdminTeacher(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    plan: Plan
    created_at: datetime
    tests: int
    attempts: int
    last_test_at: datetime | None


class AdminPlanIn(BaseModel):
    plan: Plan


class AdminPlanOut(BaseModel):
    id: uuid.UUID
    plan: Plan
