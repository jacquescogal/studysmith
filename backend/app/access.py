from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import (
    APP_ROLE_ADMIN,
    Job,
    Module,
    NoteGroup,
    QuestionCard,
    StudyCard,
    SUBJECT_ACCESS_MAINTAINER,
    SUBJECT_ACCESS_OWNER,
    SUBJECT_ACCESS_READER,
    SUBJECT_VISIBILITY_PUBLIC,
    Subject,
    SubjectAccess,
    TopicChip,
    User,
)


READ_LEVELS = {SUBJECT_ACCESS_READER, SUBJECT_ACCESS_MAINTAINER, SUBJECT_ACCESS_OWNER}
MAINTAIN_LEVELS = {SUBJECT_ACCESS_MAINTAINER, SUBJECT_ACCESS_OWNER}
READABLE_NOTE_GROUP_GENERATION_STATUSES = {"created", "complete"}


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


def subject_access_level(user: User | None, subject: Subject) -> str | None:
    explicit_level = _access_level(user, subject)
    if explicit_level:
        return explicit_level
    if user and subject.visibility == SUBJECT_VISIBILITY_PUBLIC:
        return SUBJECT_ACCESS_READER
    return None


def can_study_subject(user: User | None, subject: Subject) -> bool:
    return user is not None and can_read_subject(user, subject)


def can_edit_subject(user: User | None, subject: Subject) -> bool:
    return _access_level(user, subject) in MAINTAIN_LEVELS


def can_maintain_subject(user: User | None, subject: Subject) -> bool:
    return _access_level(user, subject) in MAINTAIN_LEVELS


def can_own_subject(user: User | None, subject: Subject) -> bool:
    return _access_level(user, subject) == SUBJECT_ACCESS_OWNER


def require_subject_read(user: User | None, subject: Subject) -> None:
    if not can_read_subject(user, subject):
        raise HTTPException(status_code=404, detail="Subject not found")


def require_subject_study(user: User | None, subject: Subject) -> None:
    if not can_study_subject(user, subject):
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required to study")
        raise HTTPException(status_code=403, detail="Subject access required to study")


def require_subject_edit(user: User | None, subject: Subject) -> None:
    if not can_edit_subject(user, subject):
        raise HTTPException(status_code=403, detail="Maintainer access required")


def require_subject_maintainer(user: User | None, subject: Subject) -> None:
    if not can_maintain_subject(user, subject):
        raise HTTPException(status_code=403, detail="Maintainer access required")


def require_subject_owner(user: User | None, subject: Subject) -> None:
    if not can_own_subject(user, subject):
        raise HTTPException(status_code=403, detail="Owner access required")


def readable_subject_filter(user: User | None):
    if user is None:
        return Subject.visibility == SUBJECT_VISIBILITY_PUBLIC
    if user.app_role == APP_ROLE_ADMIN:
        return Subject.id.isnot(None)
    return or_(
        Subject.visibility == SUBJECT_VISIBILITY_PUBLIC,
        Subject.owner_user_id == user.id,
        Subject.access_grants.any(
            and_(
                SubjectAccess.user_id == user.id,
                SubjectAccess.access_level.in_(READ_LEVELS),
            )
        ),
    )


def editable_subject_filter(user: User):
    if user.app_role == APP_ROLE_ADMIN:
        return Subject.id.isnot(None)
    return or_(
        Subject.owner_user_id == user.id,
        Subject.access_grants.any(
            and_(
                SubjectAccess.user_id == user.id,
                SubjectAccess.access_level.in_(MAINTAIN_LEVELS),
            )
        ),
    )


def require_module_read(db: Session, user: User | None, module_id: str) -> Module:
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    require_subject_read(user, module.subject)
    return module


def require_module_edit(db: Session, user: User | None, module_id: str) -> Module:
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    require_subject_edit(user, module.subject)
    return module


def require_module_study(db: Session, user: User | None, module_id: str) -> Module:
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    require_subject_study(user, module.subject)
    return module


def require_note_group_read(db: Session, user: User | None, note_group_id: str) -> NoteGroup:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    require_subject_read(user, note_group.module.subject)
    if (
        note_group.generation_status not in READABLE_NOTE_GROUP_GENERATION_STATUSES
        and not can_maintain_subject(user, note_group.module.subject)
    ):
        raise HTTPException(status_code=404, detail="Note group not found")
    return note_group


def require_note_group_edit(db: Session, user: User | None, note_group_id: str) -> NoteGroup:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    require_subject_edit(user, note_group.module.subject)
    return note_group


def require_note_group_study(db: Session, user: User | None, note_group_id: str) -> NoteGroup:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    require_subject_study(user, note_group.module.subject)
    return note_group


def require_topic_read(db: Session, user: User | None, topic_id: str):
    topic = db.get(TopicChip, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Concept not found")
    require_subject_read(user, topic.module.subject)
    return topic


def require_topic_edit(db: Session, user: User | None, topic_id: str):
    topic = db.get(TopicChip, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Concept not found")
    require_subject_edit(user, topic.module.subject)
    return topic


def require_topic_study(db: Session, user: User | None, topic_id: str):
    topic = db.get(TopicChip, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Concept not found")
    require_subject_study(user, topic.module.subject)
    return topic


def require_study_card_read(db: Session, user: User | None, study_card_id: str) -> StudyCard:
    card = db.get(StudyCard, study_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Study card not found")
    require_subject_read(user, card.note_group.module.subject)
    return card


def require_study_card_edit(db: Session, user: User | None, study_card_id: str) -> StudyCard:
    card = db.get(StudyCard, study_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Study card not found")
    require_subject_edit(user, card.note_group.module.subject)
    return card


def require_question_card_edit(db: Session, user: User | None, question_card_id: str) -> QuestionCard:
    card = db.get(QuestionCard, question_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")
    require_subject_edit(user, card.note_group.module.subject)
    return card


def require_question_card_study(db: Session, user: User | None, question_card_id: str) -> QuestionCard:
    card = db.get(QuestionCard, question_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")
    require_subject_study(user, card.note_group.module.subject)
    return card


def require_job_read(db: Session, user: User | None, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.note_group:
        if not user or user.app_role != APP_ROLE_ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        return job
    require_subject_edit(user, job.note_group.module.subject)
    return job


def require_job_edit(db: Session, user: User | None, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.note_group:
        if not user or user.app_role != APP_ROLE_ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        return job
    require_subject_edit(user, job.note_group.module.subject)
    return job


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
