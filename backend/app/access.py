from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    APP_ROLE_ADMIN,
    SUBJECT_ACCESS_EDIT,
    SUBJECT_ACCESS_OWNER,
    SUBJECT_ACCESS_READ,
    SUBJECT_VISIBILITY_PUBLIC,
    Subject,
    SubjectAccess,
    User,
)


READ_LEVELS = {SUBJECT_ACCESS_READ, SUBJECT_ACCESS_EDIT, SUBJECT_ACCESS_OWNER}
EDIT_LEVELS = {SUBJECT_ACCESS_EDIT, SUBJECT_ACCESS_OWNER}


def _access_level(user: User | None, subject: Subject) -> str | None:
    if not user:
        return None
    if user.app_role == APP_ROLE_ADMIN:
        return SUBJECT_ACCESS_OWNER
    if subject.owner_user_id == user.id:
        return SUBJECT_ACCESS_OWNER
    for grant in subject.access_grants:
        if grant.user_id == user.id:
            return grant.access_level
    return None


def can_read_subject(user: User | None, subject: Subject) -> bool:
    if subject.visibility == SUBJECT_VISIBILITY_PUBLIC:
        return True
    return _access_level(user, subject) in READ_LEVELS


def can_study_subject(user: User | None, subject: Subject) -> bool:
    return user is not None and can_read_subject(user, subject)


def can_edit_subject(user: User | None, subject: Subject) -> bool:
    return _access_level(user, subject) in EDIT_LEVELS


def require_subject_read(user: User | None, subject: Subject) -> None:
    if not can_read_subject(user, subject):
        raise HTTPException(status_code=404, detail="Subject not found")


def require_subject_study(user: User | None, subject: Subject) -> None:
    if not can_study_subject(user, subject):
        raise HTTPException(status_code=401 if user is None else 403, detail="Authentication required to study")


def require_subject_edit(user: User | None, subject: Subject) -> None:
    if not can_edit_subject(user, subject):
        raise HTTPException(status_code=403, detail="Edit access required")


def grant_owner_access(db: Session, subject: Subject, user: User) -> SubjectAccess:
    existing = (
        db.query(SubjectAccess)
        .filter(SubjectAccess.subject_id == subject.id, SubjectAccess.user_id == user.id)
        .one_or_none()
    )
    if existing:
        existing.access_level = SUBJECT_ACCESS_OWNER
        return existing
    grant = SubjectAccess(subject_id=subject.id, user_id=user.id, access_level=SUBJECT_ACCESS_OWNER)
    db.add(grant)
    return grant
