import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_teacher
from ..models import BookUnit, Teacher
from ..schemas import BookOut, BookUnitOut, BulkUnitsIn
from ..units_parse import parse_units

router = APIRouter(prefix="/books", tags=["books"])


def _all_books(db: Session, teacher: Teacher) -> list[BookOut]:
    units = db.scalars(
        select(BookUnit)
        .where(BookUnit.teacher_id == teacher.id)
        .order_by(BookUnit.book, BookUnit.id)
    ).all()
    grouped: dict[str, list[BookUnitOut]] = {}
    for u in units:
        grouped.setdefault(u.book, []).append(
            BookUnitOut(id=u.id, label=u.label, topics=u.topics)
        )
    return [BookOut(book=b, units=us) for b, us in grouped.items()]


@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return _all_books(db, teacher)


@router.post("/units/bulk", response_model=list[BookOut])
def bulk_units(
    body: BulkUnitsIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    book = body.book.strip()
    parsed = parse_units(body.text)
    if not book or not parsed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No units found")
    existing = {
        u.label: u
        for u in db.scalars(
            select(BookUnit).where(BookUnit.teacher_id == teacher.id, BookUnit.book == book)
        )
    }
    for label, topics in parsed:
        if label in existing:
            existing[label].topics = topics
        else:
            db.add(BookUnit(teacher_id=teacher.id, book=book, label=label, topics=topics))
    db.commit()
    return _all_books(db, teacher)


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    db.execute(delete(BookUnit).where(BookUnit.id == unit_id, BookUnit.teacher_id == teacher.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    db.execute(delete(BookUnit).where(BookUnit.teacher_id == teacher.id, BookUnit.book == book))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
