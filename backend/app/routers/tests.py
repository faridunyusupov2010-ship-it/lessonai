import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from .. import llm
from ..db import get_db
from ..deps import get_current_teacher
from ..export import build_docx
from ..translate import localize_explanations
from ..models import (
    Attempt,
    Plan,
    Question,
    Teacher,
    Test,
    BookUnit,
    ExplanationTranslation,
    TestQuestion,
)
from ..schemas import (
    GenerateIn,
    QuestionBase,
    QuestionOut,
    TestOut,
    TestSummary,
    TestUpdate,
)

router = APIRouter(tags=["tests"])

FREE_TESTS_PER_MONTH = 20


def _test_to_out(test: Test) -> TestOut:
    return TestOut(
        id=test.id,
        title=test.title,
        topic=test.topic,
        level=test.level,
        status=test.status,
        share_token=test.share_token,
        time_limit_minutes=test.time_limit_minutes,
        created_at=test.created_at,
        questions=[QuestionOut.model_validate(tq.question) for tq in test.test_questions],
    )


def _get_owned_test(db: Session, test_id: uuid.UUID, teacher: Teacher) -> Test:
    test = db.scalar(
        select(Test)
        .where(Test.id == test_id, Test.teacher_id == teacher.id)
        .options(selectinload(Test.test_questions).selectinload(TestQuestion.question))
    )
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


def _check_quota(db: Session, teacher: Teacher) -> None:
    if teacher.plan != Plan.free:
        return
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = db.scalar(
        select(func.count())
        .select_from(Test)
        .where(Test.teacher_id == teacher.id, Test.created_at >= month_start)
    )
    if used >= FREE_TESTS_PER_MONTH:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Free plan limit reached ({FREE_TESTS_PER_MONTH} tests per month)",
        )


# ----------------------------- Tests -----------------------------


@router.post("/tests/generate", response_model=TestOut, status_code=status.HTTP_201_CREATED)
def generate_test(
    body: GenerateIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    _check_quota(db, teacher)

    unit_context = None
    if body.book_unit_id is not None:
        unit = db.scalar(
            select(BookUnit).where(
                BookUnit.id == body.book_unit_id, BookUnit.teacher_id == teacher.id
            )
        )
        if unit is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Book unit not found")
        unit_context = f"{unit.book}, unit {unit.label}: {', '.join(unit.topics)}"

    try:
        generated = llm.generate_questions(
            topic=body.topic.strip(),
            level=body.level,
            types=body.types,
            count=body.count,
            ui_language=teacher.ui_language.value,
            unit_context=unit_context,
        )
    except llm.LLMError as e:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "not configured" in str(e)
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(code, str(e))

    test = Test(
        teacher_id=teacher.id,
        title=(body.title or f"{body.topic.strip()} ({body.level.value})").strip(),
        topic=body.topic.strip(),
        level=body.level,
    )
    db.add(test)
    db.flush()

    for position, q in enumerate(generated, start=1):
        question = Question(
            teacher_id=teacher.id,
            type=q.type,
            level=body.level,
            topic_tag=q.topic_tag.strip(),
            prompt=q.prompt.strip(),
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            ai_generated=True,
        )
        db.add(question)
        db.flush()
        db.add(TestQuestion(test_id=test.id, question_id=question.id, position=position))

    db.commit()
    return _test_to_out(_get_owned_test(db, test.id, teacher))


@router.get("/tests", response_model=list[TestSummary])
def list_tests(
    db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)
):
    rows = db.execute(
        select(Test, func.count(TestQuestion.id))
        .outerjoin(TestQuestion, TestQuestion.test_id == Test.id)
        .where(Test.teacher_id == teacher.id)
        .group_by(Test.id)
        .order_by(Test.created_at.desc())
    ).all()
    return [
        TestSummary(
            id=t.id,
            title=t.title,
            topic=t.topic,
            level=t.level,
            status=t.status,
            share_token=t.share_token,
            created_at=t.created_at,
            question_count=n,
        )
        for t, n in rows
    ]


@router.get("/tests/{test_id}", response_model=TestOut)
def get_test(
    test_id: uuid.UUID,
    lang: str | None = None,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    out = _test_to_out(test)
    if lang:
        expl = localize_explanations(db, [tq.question for tq in test.test_questions], lang)
        for q in out.questions:
            if q.id in expl:
                q.explanation = expl[q.id]
    return out


@router.patch("/tests/{test_id}", response_model=TestOut)
def update_test(
    test_id: uuid.UUID,
    body: TestUpdate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(test, field, value)
    db.commit()
    return _test_to_out(_get_owned_test(db, test_id, teacher))


@router.delete("/tests/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test(
    test_id: uuid.UUID,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    # Кӯшишҳо (ва ҷавобҳо тавассути ON DELETE CASCADE) пеш аз тест тоза мешаванд
    db.execute(delete(Attempt).where(Attempt.test_id == test.id))
    db.delete(test)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/tests/{test_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_question_from_test(
    test_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    tq = next((x for x in test.test_questions if x.question_id == question_id), None)
    if tq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not in this test")
    db.delete(tq)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------- Questions ---------------------------


@router.put("/questions/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: uuid.UUID,
    body: QuestionBase,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    question = db.scalar(
        select(Question).where(Question.id == question_id, Question.teacher_id == teacher.id)
    )
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    question.type = body.type
    question.topic_tag = body.topic_tag.strip()
    question.prompt = body.prompt.strip()
    question.options = body.options
    question.correct_answer = body.correct_answer
    question.explanation = body.explanation
    question.ai_generated = False
    db.execute(delete(ExplanationTranslation).where(ExplanationTranslation.question_id == question.id))
    db.commit()
    return QuestionOut.model_validate(question)


@router.get("/tests/{test_id}/export.docx")
def export_docx(
    test_id: uuid.UUID,
    answers: bool = False,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    data = build_docx(test, answers)
    name = f"{test.title}{' - answer key' if answers else ''}.docx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
    )
