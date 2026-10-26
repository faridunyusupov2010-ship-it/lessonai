from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_teacher, is_admin_email
from ..models import Teacher
from ..schemas import LoginIn, ProfileUpdate, RegisterIn, TeacherOut, TokenOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def teacher_out(teacher: Teacher) -> TeacherOut:
    out = TeacherOut.model_validate(teacher)
    out.is_admin = is_admin_email(teacher.email)
    return out


def _token_response(teacher: Teacher) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(str(teacher.id)),
        teacher=teacher_out(teacher),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.scalar(select(Teacher).where(Teacher.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    teacher = Teacher(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        ui_language=body.ui_language,
    )
    db.add(teacher)
    db.commit()
    return _token_response(teacher)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    teacher = db.scalar(select(Teacher).where(Teacher.email == body.email.strip().lower()))
    if teacher is None or not verify_password(body.password, teacher.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _token_response(teacher)


@router.get("/me", response_model=TeacherOut)
def me(teacher: Teacher = Depends(get_current_teacher)):
    return teacher_out(teacher)


@router.patch("/me", response_model=TeacherOut)
def update_me(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    if body.ui_language is not None:
        teacher.ui_language = body.ui_language
    db.commit()
    return teacher_out(teacher)
