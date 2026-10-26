import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Teacher
from .security import decode_access_token

bearer = HTTPBearer()


def get_current_teacher(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Teacher:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    sub = decode_access_token(creds.credentials)
    if not sub:
        raise unauthorized
    try:
        teacher_id = uuid.UUID(sub)
    except ValueError:
        raise unauthorized
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise unauthorized
    return teacher


def is_admin_email(email: str) -> bool:
    return email.lower() in {e.strip().lower() for e in settings.admin_emails}


def get_admin(teacher: Teacher = Depends(get_current_teacher)) -> Teacher:
    if not is_admin_email(teacher.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return teacher
