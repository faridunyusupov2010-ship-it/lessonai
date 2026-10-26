from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..grading import is_correct
from ..models import Attempt, AttemptAnswer, Question, Test, TestQuestion, TestStatus, utcnow
from ..schemas import PublicQuestion, PublicTest, QuestionResult, SubmitIn, SubmitOut
from ..translate import localize_explanations

router = APIRouter(prefix="/public", tags=["public"])


def make_result(
    q: Question,
    response,
    ok: bool,
    points_awarded: float,
    points: float,
    explanation: str | None = None,
) -> QuestionResult:
    return QuestionResult(
        question_id=q.id,
        type=q.type,
        prompt=q.prompt,
        options=q.options,
        response=response,
        is_correct=ok,
        correct_answer=q.correct_answer,
        explanation=explanation if explanation is not None else q.explanation,
        points_awarded=points_awarded,
        points=points,
    )


def _get_published(db: Session, token: str) -> Test:
    test = db.scalar(
        select(Test)
        .where(Test.share_token == token)
        .options(selectinload(Test.test_questions).selectinload(TestQuestion.question))
    )
    if test is None or test.status != TestStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


@router.get("/tests/{token}", response_model=PublicTest)
def get_public_test(token: str, db: Session = Depends(get_db)):
    test = _get_published(db, token)
    return PublicTest(
        title=test.title,
        topic=test.topic,
        level=test.level,
        time_limit_minutes=test.time_limit_minutes,
        # Ҷавоби дуруст ва шарҳ дидаю дониста фиристода намешаванд
        questions=[
            PublicQuestion(
                id=tq.question.id,
                type=tq.question.type,
                prompt=tq.question.prompt,
                options=tq.question.options,
            )
            for tq in test.test_questions
        ],
    )


@router.post("/tests/{token}/submit", response_model=SubmitOut)
def submit_test(token: str, body: SubmitIn, db: Session = Depends(get_db)):
    test = _get_published(db, token)
    given = {a.question_id: a.response for a in body.answers}

    attempt = Attempt(
        test_id=test.id,
        student_name=body.student_name.strip(),
        submitted_at=utcnow(),
    )
    db.add(attempt)
    db.flush()

    graded = []
    score = 0.0
    max_score = 0.0
    for tq in test.test_questions:
        q = tq.question
        response = given.get(q.id)
        ok = is_correct(q.type.value, q.correct_answer, response)
        awarded = tq.points if ok else 0.0
        score += awarded
        max_score += tq.points
        db.add(
            AttemptAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                response=response,
                is_correct=ok,
                points_awarded=awarded,
            )
        )
        graded.append((q, response, ok, awarded, tq.points))

    attempt.score = score
    attempt.max_score = max_score
    db.commit()

    # Шарҳҳо ба забони хонанда (дар кэш захира мешаванд)
    expl = localize_explanations(db, [g[0] for g in graded], body.lang)
    results = [make_result(q, r, ok, aw, pts, expl.get(q.id)) for q, r, ok, aw, pts in graded]
    return SubmitOut(
        attempt_id=attempt.id, score=score, max_score=max_score, results=results
    )
