from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_teacher
from ..models import Attempt, AttemptAnswer, Question, Teacher, Test
from ..schemas import StudentSummary, TopicStat

router = APIRouter(prefix="/reports", tags=["reports"])


def _student_key():
    return func.lower(func.trim(Attempt.student_name))


@router.get("/students", response_model=list[StudentSummary])
def students(db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    key = _student_key()
    rows = db.execute(
        select(
            func.max(Attempt.student_name),
            func.count(Attempt.id),
            func.sum(Attempt.score),
            func.sum(Attempt.max_score),
            func.max(Attempt.submitted_at),
        )
        .join(Test, Test.id == Attempt.test_id)
        .where(Test.teacher_id == teacher.id, Attempt.submitted_at.is_not(None))
        .group_by(key)
        .order_by(func.max(Attempt.submitted_at).desc())
    ).all()
    return [
        StudentSummary(
            name=name,
            attempts=int(n),
            percent=round(float(score) / float(mx) * 100, 1) if mx else None,
            last_at=last,
        )
        for name, n, score, mx, last in rows
    ]


@router.get("/topics", response_model=list[TopicStat])
def topics(
    student: str | None = None,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    topic_key = func.lower(Question.topic_tag)
    stmt = (
        select(
            func.max(Question.topic_tag),
            func.count(AttemptAnswer.id),
            func.sum(case((AttemptAnswer.is_correct.is_(True), 1), else_=0)),
        )
        .join(Question, Question.id == AttemptAnswer.question_id)
        .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
        .join(Test, Test.id == Attempt.test_id)
        .where(Test.teacher_id == teacher.id, Attempt.submitted_at.is_not(None))
    )
    if student and student.strip():
        stmt = stmt.where(_student_key() == student.strip().lower())
    rows = db.execute(stmt.group_by(topic_key)).all()
    stats = [
        TopicStat(
            topic=topic,
            correct=int(correct or 0),
            total=int(total),
            percent=round(int(correct or 0) / int(total) * 100, 1),
        )
        for topic, total, correct in rows
        if total
    ]
    stats.sort(key=lambda s: (s.percent, -s.total))
    return stats
