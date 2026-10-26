import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_teacher
from ..models import CEFRLevel, Question, QuestionType, Teacher, Test, TestQuestion
from ..schemas import AddQuestionsIn, BankToggleIn, CreateTestIn, QuestionOut, TestOut
from .tests import _check_quota, _get_owned_test, _test_to_out

router = APIRouter(tags=["bank"])


@router.patch("/questions/{question_id}/bank", response_model=QuestionOut)
def set_bank(
    question_id: uuid.UUID,
    body: BankToggleIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    q = db.scalar(
        select(Question).where(Question.id == question_id, Question.teacher_id == teacher.id)
    )
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    q.in_bank = body.in_bank
    db.commit()
    return QuestionOut.model_validate(q)


@router.get("/bank", response_model=list[QuestionOut])
def list_bank(
    level: CEFRLevel | None = None,
    qtype: QuestionType | None = Query(default=None, alias="type"),
    q: str | None = None,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    stmt = select(Question).where(Question.teacher_id == teacher.id, Question.in_bank.is_(True))
    if level is not None:
        stmt = stmt.where(Question.level == level)
    if qtype is not None:
        stmt = stmt.where(Question.type == qtype)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Question.prompt.ilike(like), Question.topic_tag.ilike(like)))
    rows = db.scalars(stmt.order_by(Question.created_at.desc()).limit(200)).all()
    return [QuestionOut.model_validate(x) for x in rows]


@router.post("/tests", response_model=TestOut, status_code=status.HTTP_201_CREATED)
def create_empty_test(
    body: CreateTestIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    _check_quota(db, teacher)
    test = Test(
        teacher_id=teacher.id,
        title=body.title.strip(),
        topic=body.topic.strip(),
        level=body.level,
    )
    db.add(test)
    db.commit()
    return _test_to_out(_get_owned_test(db, test.id, teacher))


@router.post("/tests/{test_id}/questions", response_model=TestOut)
def add_from_bank(
    test_id: uuid.UUID,
    body: AddQuestionsIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    test = _get_owned_test(db, test_id, teacher)
    sources = {
        x.id: x
        for x in db.scalars(
            select(Question).where(
                Question.id.in_(body.question_ids), Question.teacher_id == teacher.id
            )
        )
    }
    position = max((tq.position for tq in test.test_questions), default=0)
    for qid in body.question_ids:
        src = sources.get(qid)
        if src is None:
            continue
        position += 1
        # Нусха мегирем: таҳрири савол дар як тест ба тестҳои дигар таъсир намерасонад
        clone = Question(
            teacher_id=teacher.id,
            type=src.type,
            level=src.level,
            topic_tag=src.topic_tag,
            prompt=src.prompt,
            options=src.options,
            correct_answer=src.correct_answer,
            explanation=src.explanation,
            in_bank=False,
            ai_generated=src.ai_generated,
        )
        db.add(clone)
        db.flush()
        db.add(TestQuestion(test_id=test.id, question_id=clone.id, position=position))
    db.commit()
    db.expire_all()
    return _test_to_out(_get_owned_test(db, test_id, teacher))
