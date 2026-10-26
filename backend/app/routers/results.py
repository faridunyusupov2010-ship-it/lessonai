import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import get_current_teacher
from ..models import Attempt, AttemptAnswer, Teacher, Test, TestQuestion
from ..schemas import AttemptDetail, AttemptSummary, QuestionStat, TestResults
from ..translate import localize_explanations
from .public import make_result

router = APIRouter(tags=["results"])


@router.get("/tests/{test_id}/results", response_model=TestResults)
def test_results(
    test_id: uuid.UUID,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = db.scalar(
        select(Test)
        .where(Test.id == test_id, Test.teacher_id == teacher.id)
        .options(selectinload(Test.test_questions).selectinload(TestQuestion.question))
    )
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")

    attempts = db.scalars(
        select(Attempt)
        .where(Attempt.test_id == test.id, Attempt.submitted_at.is_not(None))
        .order_by(Attempt.submitted_at.desc())
    ).all()

    rows = db.execute(
        select(
            AttemptAnswer.question_id,
            func.count(AttemptAnswer.id),
            func.sum(case((AttemptAnswer.is_correct.is_(True), 1), else_=0)),
        )
        .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
        .where(Attempt.test_id == test.id)
        .group_by(AttemptAnswer.question_id)
    ).all()
    stats = {qid: (int(total), int(correct or 0)) for qid, total, correct in rows}

    questions = []
    for tq in test.test_questions:
        total, correct = stats.get(tq.question_id, (0, 0))
        questions.append(
            QuestionStat(
                question_id=tq.question_id,
                position=tq.position,
                prompt=tq.question.prompt,
                topic_tag=tq.question.topic_tag,
                correct=correct,
                total=total,
            )
        )

    percents = [a.score / a.max_score * 100 for a in attempts if a.score is not None and a.max_score]
    average = round(sum(percents) / len(percents), 1) if percents else None

    return TestResults(
        title=test.title,
        attempts=[
            AttemptSummary(
                id=a.id,
                student_name=a.student_name,
                submitted_at=a.submitted_at,
                score=a.score,
                max_score=a.max_score,
            )
            for a in attempts
        ],
        questions=questions,
        average_percent=average,
    )


@router.get("/attempts/{attempt_id}", response_model=AttemptDetail)
def attempt_detail(
    attempt_id: uuid.UUID,
    lang: str | None = None,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    attempt = db.scalar(
        select(Attempt)
        .join(Test, Attempt.test_id == Test.id)
        .where(Attempt.id == attempt_id, Test.teacher_id == teacher.id)
        .options(selectinload(Attempt.answers).selectinload(AttemptAnswer.question))
    )
    if attempt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")

    tqs = {
        tq.question_id: tq
        for tq in db.scalars(select(TestQuestion).where(TestQuestion.test_id == attempt.test_id))
    }
    answers = sorted(
        attempt.answers,
        key=lambda a: tqs[a.question_id].position if a.question_id in tqs else 10_000,
    )
    expl = localize_explanations(db, [a.question for a in answers], lang)
    results = [
        make_result(
            a.question,
            a.response,
            bool(a.is_correct),
            a.points_awarded,
            tqs[a.question_id].points if a.question_id in tqs else 1.0,
            expl.get(a.question_id),
        )
        for a in answers
    ]
    return AttemptDetail(
        id=attempt.id,
        student_name=attempt.student_name,
        submitted_at=attempt.submitted_at,
        score=attempt.score,
        max_score=attempt.max_score,
        results=results,
    )
