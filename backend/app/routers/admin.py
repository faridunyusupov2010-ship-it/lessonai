import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_admin
from ..models import Attempt, Plan, Teacher, Test
from ..schemas import AdminPlanIn, AdminPlanOut, AdminStats, AdminTeacher

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db), admin: Teacher = Depends(get_admin)):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    def count(stmt) -> int:
        return int(db.scalar(stmt) or 0)

    return AdminStats(
        teachers=count(select(func.count(Teacher.id))),
        pro_teachers=count(select(func.count(Teacher.id)).where(Teacher.plan == Plan.pro)),
        new_teachers_7d=count(select(func.count(Teacher.id)).where(Teacher.created_at >= week_ago)),
        tests=count(select(func.count(Test.id))),
        tests_today=count(select(func.count(Test.id)).where(Test.created_at >= day_start)),
        attempts=count(select(func.count(Attempt.id)).where(Attempt.submitted_at.is_not(None))),
    )


@router.get("/teachers", response_model=list[AdminTeacher])
def teachers(db: Session = Depends(get_db), admin: Teacher = Depends(get_admin)):
    tests_sub = (
        select(
            Test.teacher_id.label("teacher_id"),
            func.count(Test.id).label("n"),
            func.max(Test.created_at).label("last"),
        )
        .group_by(Test.teacher_id)
        .subquery()
    )
    attempts_sub = (
        select(Test.teacher_id.label("teacher_id"), func.count(Attempt.id).label("n"))
        .join(Attempt, Attempt.test_id == Test.id)
        .where(Attempt.submitted_at.is_not(None))
        .group_by(Test.teacher_id)
        .subquery()
    )
    rows = db.execute(
        select(Teacher, tests_sub.c.n, tests_sub.c.last, attempts_sub.c.n)
        .outerjoin(tests_sub, tests_sub.c.teacher_id == Teacher.id)
        .outerjoin(attempts_sub, attempts_sub.c.teacher_id == Teacher.id)
        .order_by(Teacher.created_at.desc())
    ).all()
    return [
        AdminTeacher(
            id=t.id,
            email=t.email,
            full_name=t.full_name,
            plan=t.plan,
            created_at=t.created_at,
            tests=int(tests or 0),
            attempts=int(attempts or 0),
            last_test_at=last,
        )
        for t, tests, last, attempts in rows
    ]


@router.patch("/teachers/{teacher_id}", response_model=AdminPlanOut)
def set_plan(
    teacher_id: uuid.UUID,
    body: AdminPlanIn,
    db: Session = Depends(get_db),
    admin: Teacher = Depends(get_admin),
):
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found")
    teacher.plan = body.plan
    db.commit()
    return AdminPlanOut(id=teacher.id, plan=teacher.plan)
