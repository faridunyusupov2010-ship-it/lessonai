import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

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
