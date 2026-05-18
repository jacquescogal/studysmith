import secrets

from sqlalchemy.orm import Session

from app.models import (
    Module,
    ModuleShortCode,
    NoteGroup,
    NoteGroupShortCode,
    Subject,
    SubjectShortCode,
)

SHORT_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
SUBJECT_SHORT_CODE_LENGTH = 5
MODULE_SHORT_CODE_LENGTH = 6
NOTE_GROUP_SHORT_CODE_LENGTH = 7
COLLISION_ATTEMPTS_BEFORE_LENGTHEN = 20


def _random_short_code(length: int) -> str:
    return "".join(secrets.choice(SHORT_CODE_ALPHABET) for _ in range(length))


def _generate_unique_short_code(db: Session, model, default_length: int) -> str:
    length = default_length
    attempts_at_length = 0
    while True:
        code = _random_short_code(length)
        exists = db.query(model).filter(model.short_code == code).first()
        if not exists:
            return code
        attempts_at_length += 1
        if attempts_at_length >= COLLISION_ATTEMPTS_BEFORE_LENGTHEN:
            length += 1
            attempts_at_length = 0


def _ensure_short_code(
    db: Session,
    entity,
    relationship_name: str,
    model,
    id_field: str,
    default_length: int,
) -> str:
    record = getattr(entity, relationship_name)
    if record:
        return record.short_code

    entity_id = getattr(entity, "id")
    record = db.query(model).filter(getattr(model, id_field) == entity_id).first()
    if record:
        setattr(entity, relationship_name, record)
        return record.short_code

    code = _generate_unique_short_code(db, model, default_length)
    record = model(**{id_field: entity_id, "short_code": code})
    db.add(record)
    db.flush()
    setattr(entity, relationship_name, record)
    return code


def ensure_subject_short_code(db: Session, subject: Subject) -> str:
    return _ensure_short_code(
        db,
        subject,
        "short_code_record",
        SubjectShortCode,
        "subject_id",
        SUBJECT_SHORT_CODE_LENGTH,
    )


def ensure_module_short_code(db: Session, module: Module) -> str:
    return _ensure_short_code(
        db,
        module,
        "short_code_record",
        ModuleShortCode,
        "module_id",
        MODULE_SHORT_CODE_LENGTH,
    )


def ensure_note_group_short_code(db: Session, note_group: NoteGroup) -> str:
    return _ensure_short_code(
        db,
        note_group,
        "short_code_record",
        NoteGroupShortCode,
        "note_group_id",
        NOTE_GROUP_SHORT_CODE_LENGTH,
    )


def ensure_subject_short_codes(db: Session, subjects: list[Subject]) -> None:
    for subject in subjects:
        ensure_subject_short_code(db, subject)


def ensure_module_short_codes(db: Session, modules: list[Module]) -> None:
    for module in modules:
        ensure_module_short_code(db, module)


def ensure_note_group_short_codes(db: Session, note_groups: list[NoteGroup]) -> None:
    for note_group in note_groups:
        ensure_note_group_short_code(db, note_group)
