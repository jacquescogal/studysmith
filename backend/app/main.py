import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fsrs import Rating
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, func, or_, text

from app.db import Base, engine, get_db
from sqlalchemy.exc import IntegrityError
from app.access import (
    grant_owner_access,
    readable_subject_filter,
    require_job_edit,
    require_job_read,
    require_module_edit,
    require_module_read,
    require_module_study,
    require_note_group_edit,
    require_note_group_read,
    require_note_group_study,
    require_question_card_edit,
    require_question_card_study,
    require_study_card_edit,
    require_study_card_read,
    require_subject_edit,
    require_subject_maintainer,
    require_subject_owner,
    require_subject_read,
    require_subject_study,
    require_topic_edit,
    require_topic_read,
    require_topic_study,
    subject_access_level,
)
from app.auth import optional_user, require_admin, require_creator, require_user
from app.auto_queue import enqueue_auto_job, remove_auto_job, resume_auto_jobs, start_auto_worker
from app.jobs import (
    JOB_TYPE_MIND_MAP_GENERATION,
    JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION,
    JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
    run_mind_map_generation,
    run_question_card_generation,
)
from app.mind_map import (
    build_module_mind_map_response,
    build_note_group_mind_map_response,
    mark_note_group_mind_map_stale,
)
from app.models import (
    APP_ROLE_ADMIN,
    APP_ROLE_CREATOR,
    APP_ROLES,
    DEFAULT_MODULE_SETTINGS,
    Job,
    Module,
    ModuleShortCode,
    NoteGroup,
    NoteGroupShortCode,
    QuestionCard,
    QuestionCardLearningState,
    QuestionCardReviewEvent,
    StudyCard,
    StudyCardSourceRange,
    Subject,
    SubjectAccess,
    SubjectActivityEvent,
    SubjectShortCode,
    SUBJECT_ACTIVITY_CREATED,
    SUBJECT_ACTIVITY_DELETED,
    SUBJECT_ACTIVITY_MODULE,
    SUBJECT_ACTIVITY_NOTE_GROUP,
    SUBJECT_ACTIVITY_QUESTION_CARD,
    SUBJECT_ACTIVITY_STUDY_CARD,
    SUBJECT_ACCESS_LEVELS,
    SUBJECT_ACCESS_MAINTAINER,
    SUBJECT_ACCESS_OWNER,
    SUBJECT_VISIBILITY_PRIVATE,
    SUBJECT_VISIBILITY_PUBLIC,
    SUBJECT_VISIBILITY_PUBLIC_REQUESTED,
    TopicChip,
    TopicChipShortCode,
    User,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.short_codes import (
    ensure_module_short_code,
    ensure_module_short_codes,
    ensure_note_group_short_code,
    ensure_note_group_short_codes,
    ensure_subject_short_code,
    ensure_subject_short_codes,
    ensure_topic_chip_short_code,
    ensure_topic_chip_short_codes,
)
from app.fsrs_utils import initialize_question_card, review_question_card
from app.progress import build_note_group_progress, build_question_card_performance
from app.openai_client import (
    embed_texts,
    generate_chat_response,
    generate_module_intent_response,
    generate_subject_intent_response,
)
from app.vector_store import (
    delete_study_card_embeddings,
    query_study_card_embeddings,
    upsert_study_card_embedding,
)
from app.schemas import (
    ChatRequest,
    ChatResponse,
    AppRouteContext,
    IntentChatRequest,
    IntentChatResponse,
    JobOut,
    MindMapResponse,
    ModuleCreate,
    ModuleOut,
    ModuleOverviewResponse,
    ModuleUpdate,
    NoteGroupOut,
    NoteGroupAutoRequest,
    NoteGroupCardTableResponse,
    NoteGroupSourceCheckRequest,
    NoteGroupSourceCheckResponse,
    NoteGroupTitleUpdate,
    NoteGroupOrderUpdate,
    NoteGroupProgressResponse,
    QuestionCardCreate,
    QuestionCardGenerate,
    QuestionCardPerformanceResponse,
    QuestionCardList,
    QuestionCardOut,
    QuestionCardReview,
    QuestionCardUpdate,
    QuestionTimelineResponse,
    SubjectAccessGrantUpdate,
    SubjectAccessOut,
    SubjectActivityEventOut,
    SubjectCreate,
    SubjectIntentChatPayload,
    SubjectOut,
    SubjectUpdate,
    PublicSubjectOut,
    StudyCardCreate,
    StudyCardOut,
    StudyCardList,
    StudyCardReview,
    StudyCardReviewResult,
    StudyCardUpdate,
    TopicChipAttach,
    TopicChipCreate,
    TopicChipOut,
    UserOut,
    UserRoleUpdate,
)

MIND_MAP_ACTIVE_JOB_STATUSES = ("queued", "running")
MIND_MAP_RUNNING_JOB_TIMEOUT = timedelta(minutes=30)
STALE_MIND_MAP_JOB_ERROR = "Stale Concept Mind Map generation job superseded"


def _normalize_source_text(value: str) -> str:
    return " ".join(value.split()).lower()


def _ensure_note_group_source_columns() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(note_groups)"))
        columns = {row[1] for row in result}
        statements = []
        if "source" not in columns:
            statements.append("ALTER TABLE note_groups ADD COLUMN source TEXT")
        if "source_normalized" not in columns:
            statements.append("ALTER TABLE note_groups ADD COLUMN source_normalized TEXT")
        if "additional_generation_instructions" not in columns:
            statements.append(
                "ALTER TABLE note_groups ADD COLUMN additional_generation_instructions TEXT"
            )
        if "cleaned_text_markdown" not in columns:
            statements.append("ALTER TABLE note_groups ADD COLUMN cleaned_text_markdown TEXT")
        for statement in statements:
            conn.execute(text(statement))
        if statements:
            conn.commit()


def _word_count(value: str) -> int:
    return len([word for word in value.split() if word])


def _validate_additional_instructions(value: str) -> None:
    if _word_count(value) > 500:
        raise HTTPException(
            status_code=400,
            detail="Additional generation instructions must be 500 words or fewer",
        )


def _validate_chip_label(label: str) -> None:
    stripped = label.strip()
    if len(stripped) > 20:
        raise HTTPException(
            status_code=400,
            detail="Chip label must be 20 characters or fewer",
        )
    if len(stripped.split()) > 2:
        raise HTTPException(
            status_code=400,
            detail="Chip label must be 2 words or fewer",
        )


def _ensure_module_settings_column() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(modules)"))
        columns = {row[1] for row in result}
        if "settings_json" not in columns:
            conn.execute(text("ALTER TABLE modules ADD COLUMN settings_json TEXT"))
            conn.commit()


def _ensure_module_intent_columns() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(modules)"))
        columns = {row[1] for row in result}
        statements = []
        if "goal" not in columns:
            statements.append("ALTER TABLE modules ADD COLUMN goal TEXT")
        if "scope" not in columns:
            statements.append("ALTER TABLE modules ADD COLUMN scope TEXT")
        for statement in statements:
            conn.execute(text(statement))
        if statements:
            conn.commit()


def _ensure_topic_chip_description_column() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(topic_chips)"))
        columns = {row[1] for row in result}
        if "description" not in columns:
            conn.execute(text("ALTER TABLE topic_chips ADD COLUMN description TEXT"))
            conn.commit()


def _ensure_subject_intent_columns() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(subjects)"))}
        statements = []
        if "goal" not in cols:
            statements.append("ALTER TABLE subjects ADD COLUMN goal TEXT")
        if "scope" not in cols:
            statements.append("ALTER TABLE subjects ADD COLUMN scope TEXT")
        for statement in statements:
            conn.execute(text(statement))
        if statements:
            conn.commit()


def _ensure_subject_access_columns(target_engine=engine) -> None:
    if target_engine.url.get_backend_name() != "sqlite":
        return
    with target_engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(subjects)"))
        columns = {row[1] for row in result}
        statements = []
        if "owner_user_id" not in columns:
            statements.append("ALTER TABLE subjects ADD COLUMN owner_user_id VARCHAR")
        if "visibility" not in columns:
            statements.append("ALTER TABLE subjects ADD COLUMN visibility VARCHAR DEFAULT 'private' NOT NULL")
        for statement in statements:
            conn.execute(text(statement))
        if statements:
            conn.commit()


def _ensure_pgvector_extension(target_engine=engine) -> None:
    if target_engine.url.get_backend_name() != "postgresql":
        return
    with target_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()


_ensure_pgvector_extension()
Base.metadata.create_all(bind=engine)
_ensure_note_group_source_columns()
_ensure_module_settings_column()
_ensure_module_intent_columns()
_ensure_topic_chip_description_column()
_ensure_subject_intent_columns()
_ensure_subject_access_columns()

app = FastAPI(title="Study System API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(require_user)):
    return current_user


def _apply_current_user_access(subject: Subject, user: User | None) -> Subject:
    subject.current_user_access_level = subject_access_level(user, subject)
    return subject


def _record_subject_activity(
    db: Session,
    *,
    subject_id: str,
    actor: User | None,
    event_type: str,
    entity_type: str,
    entity_id: str,
    entity_title: str | None = None,
) -> SubjectActivityEvent:
    event = SubjectActivityEvent(
        subject_id=subject_id,
        actor_user_id=actor.id if actor else None,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_title=(entity_title or "")[:500] or None,
    )
    db.add(event)
    return event


def _serialize_subject_activity(event: SubjectActivityEvent) -> dict:
    return {
        "id": event.id,
        "subject_id": event.subject_id,
        "actor_user_id": event.actor_user_id,
        "actor_email": event.actor.email if event.actor else None,
        "event_type": event.event_type,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "entity_title": event.entity_title,
        "created_at": event.created_at,
    }


@app.on_event("startup")
def _start_auto_worker() -> None:
    start_auto_worker()
    resume_auto_jobs()


def _serialize_question_card(
    card: QuestionCard,
    learning_state: QuestionCardLearningState | None = None,
) -> dict:
    try:
        option_explanations = json.loads(card.option_explanations_json or "[]")
        if not isinstance(option_explanations, list):
            option_explanations = []
    except json.JSONDecodeError:
        option_explanations = []
    state = learning_state or card
    return {
        "id": card.id,
        "note_group_id": card.note_group_id,
        "type": card.type,
        "prompt": card.prompt,
        "options": json.loads(card.options_json),
        "correct_option_indices": json.loads(card.correct_option_indices_json),
        "option_explanations": option_explanations,
        "study_card_refs": json.loads(card.study_card_refs_json),
        "stale": card.stale,
        "due_at": state.due_at,
        "last_review_at": state.last_review_at,
        "stability": state.stability,
        "difficulty": state.difficulty,
        "elapsed_days": state.elapsed_days,
        "scheduled_days": state.scheduled_days,
        "reps": state.reps,
        "lapses": state.lapses,
        "state": state.state,
        "step": state.step,
    }


def _get_or_create_question_card_learning_state(
    db: Session,
    card: QuestionCard,
    user: User,
) -> QuestionCardLearningState:
    learning_state = (
        db.query(QuestionCardLearningState)
        .filter(
            QuestionCardLearningState.question_card_id == card.id,
            QuestionCardLearningState.user_id == user.id,
        )
        .one_or_none()
    )
    if learning_state:
        return learning_state
    learning_state = QuestionCardLearningState(
        question_card_id=card.id,
        user_id=user.id,
        due_at=card.due_at,
        last_review_at=card.last_review_at,
        stability=card.stability,
        difficulty=card.difficulty,
        elapsed_days=card.elapsed_days,
        scheduled_days=card.scheduled_days,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        step=card.step,
    )
    db.add(learning_state)
    db.flush()
    return learning_state


def _question_card_learning_state_map(
    db: Session,
    cards: list[QuestionCard],
    user: User | None,
) -> dict[str, QuestionCardLearningState]:
    card_ids = [card.id for card in cards]
    if not card_ids or user is None:
        return {}
    states = (
        db.query(QuestionCardLearningState)
        .filter(
            QuestionCardLearningState.question_card_id.in_(card_ids),
            QuestionCardLearningState.user_id == user.id,
        )
        .all()
    )
    return {state.question_card_id: state for state in states}


def _question_card_due_at(
    card: QuestionCard,
    state_by_card_id: dict[str, QuestionCardLearningState],
) -> Optional[datetime]:
    state = state_by_card_id.get(card.id)
    return state.due_at if state else card.due_at


def _serialize_question_cards_for_user(
    cards: list[QuestionCard],
    state_by_card_id: dict[str, QuestionCardLearningState],
) -> list[dict]:
    return [
        _serialize_question_card(card, state_by_card_id.get(card.id))
        for card in cards
    ]


def _review_cards_for_mode(
    cards: list[QuestionCard],
    mode: str,
    limit: int,
    state_by_card_id: dict[str, QuestionCardLearningState],
    now: datetime,
) -> list[QuestionCard]:
    due_cutoff = now + timedelta(hours=6)
    ordered = sorted(
        cards,
        key=lambda card: (_question_card_due_at(card, state_by_card_id) is None, _question_card_due_at(card, state_by_card_id) or now),
    )
    if mode == "due":
        return [
            card
            for card in ordered
            if _question_card_due_at(card, state_by_card_id) is None
            or _normalize_due_at(_question_card_due_at(card, state_by_card_id)) <= due_cutoff
        ][:limit]
    if mode == "queue":
        return ordered[:limit]
    if mode == "all":
        return ordered
    raise HTTPException(status_code=400, detail="Invalid review mode")


def _normalize_due_at(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_chip_ids(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [token.strip() for token in value.split(",") if token.strip()]


def _question_card_refs(card: QuestionCard) -> list[str]:
    try:
        refs = json.loads(card.study_card_refs_json or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(refs, list):
        return []
    return [ref for ref in refs if isinstance(ref, str)]


def _build_question_timeline(
    cards: list[QuestionCard],
    now: datetime,
    state_by_card_id: Optional[dict[str, QuestionCardLearningState]] = None,
) -> dict:
    state_by_card_id = state_by_card_id or {}
    due_cutoff = now + timedelta(hours=6)
    timeline = {"due": 0, "week": 0, "month": 0, "six_months": 0, "long_term": 0}
    for card in cards:
        due_at = _normalize_due_at(_question_card_due_at(card, state_by_card_id))
        if due_at is None or due_at <= due_cutoff:
            timeline["due"] += 1
            continue
        diff = due_at - now
        if diff <= timedelta(days=7):
            timeline["week"] += 1
        elif diff <= timedelta(days=30):
            timeline["month"] += 1
        elif diff <= timedelta(days=182):
            timeline["six_months"] += 1
        else:
            timeline["long_term"] += 1
    return timeline


def _mark_question_cards_stale(db: Session, note_group_id: str, study_card_id: str) -> None:
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .all()
    )
    updated = False
    for card in cards:
        try:
            refs = json.loads(card.study_card_refs_json)
        except json.JSONDecodeError:
            refs = []
        if study_card_id in refs and not card.stale:
            card.stale = True
            updated = True
    if updated:
        db.commit()


def _upsert_study_card_embedding(card: StudyCard, module_id: str) -> None:
    embedding = embed_texts([card.content])[0]
    db = Session.object_session(card)
    if db is None:
        raise RuntimeError("Study Card must be attached to a database session")
    upsert_study_card_embedding(db, card, module_id, embedding)


def _next_note_group_sort_order(db: Session, module_id: str) -> Optional[int]:
    max_order = (
        db.query(func.max(NoteGroup.sort_order))
        .filter(NoteGroup.module_id == module_id)
        .scalar()
    )
    if max_order is None:
        return None
    return max_order + 1


def _delete_note_groups(db: Session, note_group_ids: list[str]) -> list[str]:
    if not note_group_ids:
        return []

    jobs = db.query(Job).filter(Job.note_group_id.in_(note_group_ids)).all()
    for job in jobs:
        if job.status in {"completed", "failed", "cancelled"}:
            continue
        if job.type == JOB_TYPE_NOTE_GROUP_AUTO_GENERATION:
            remove_auto_job(job.id)
        job.status = "cancelled"
        job.error = "Note group deleted"

    study_card_rows = (
        db.query(StudyCard.id)
        .filter(StudyCard.note_group_id.in_(note_group_ids))
        .all()
    )
    study_card_ids = [row[0] for row in study_card_rows]

    if study_card_ids:
        delete_study_card_embeddings(db, study_card_ids)
        db.query(StudyCardSourceRange).filter(
            StudyCardSourceRange.study_card_id.in_(study_card_ids)
        ).delete(synchronize_session=False)
        db.execute(
            study_card_topic_chips.delete().where(
                study_card_topic_chips.c.study_card_id.in_(study_card_ids)
            )
        )

    db.execute(
        note_group_topic_chips.delete().where(
            note_group_topic_chips.c.note_group_id.in_(note_group_ids)
        )
    )
    db.query(NoteGroupShortCode).filter(
        NoteGroupShortCode.note_group_id.in_(note_group_ids)
    ).delete(synchronize_session=False)
    db.query(QuestionCard).filter(
        QuestionCard.note_group_id.in_(note_group_ids)
    ).delete(synchronize_session=False)
    db.query(StudyCard).filter(StudyCard.note_group_id.in_(note_group_ids)).delete(
        synchronize_session=False
    )
    db.query(NoteGroup).filter(NoteGroup.id.in_(note_group_ids)).delete(
        synchronize_session=False
    )

    return study_card_ids


def _reset_note_group_for_retry(db: Session, note_group: NoteGroup) -> list[str]:
    study_cards = (
        db.query(StudyCard.id)
        .filter(StudyCard.note_group_id == note_group.id)
        .all()
    )
    study_card_ids = [row[0] for row in study_cards]

    if study_card_ids:
        delete_study_card_embeddings(db, study_card_ids)
        db.query(StudyCardSourceRange).filter(
            StudyCardSourceRange.study_card_id.in_(study_card_ids)
        ).delete(synchronize_session=False)
        db.execute(
            study_card_topic_chips.delete().where(
                study_card_topic_chips.c.study_card_id.in_(study_card_ids)
            )
        )
    db.execute(
        note_group_topic_chips.delete().where(
            note_group_topic_chips.c.note_group_id == note_group.id
        )
    )
    db.query(QuestionCard).filter(
        QuestionCard.note_group_id == note_group.id
    ).delete(synchronize_session=False)
    db.query(StudyCard).filter(StudyCard.note_group_id == note_group.id).delete(
        synchronize_session=False
    )

    note_group.title = None
    note_group.formatted_text = None
    note_group.formatted_sections_json = None
    note_group.cleaned_text_markdown = None
    note_group.suggested_titles_json = None
    note_group.generation_status = "queued"

    return study_card_ids


def _commit_short_code_backfill(db: Session) -> None:
    db.commit()


def _not_found_route() -> None:
    raise HTTPException(status_code=404, detail="App route not found")


def _get_subject_short_code_record(db: Session, subject_code: str) -> SubjectShortCode:
    record = (
        db.query(SubjectShortCode)
        .filter(SubjectShortCode.short_code == subject_code)
        .first()
    )
    if not record:
        _not_found_route()
    return record


def _get_module_short_code_record(db: Session, module_code: str) -> ModuleShortCode:
    record = (
        db.query(ModuleShortCode)
        .filter(ModuleShortCode.short_code == module_code)
        .first()
    )
    if not record:
        _not_found_route()
    return record


def _get_note_group_short_code_record(
    db: Session, note_group_code: str
) -> NoteGroupShortCode:
    record = (
        db.query(NoteGroupShortCode)
        .filter(NoteGroupShortCode.short_code == note_group_code)
        .first()
    )
    if not record:
        _not_found_route()
    return record


def _get_topic_short_code_record(db: Session, topic_code: str) -> TopicChipShortCode:
    record = (
        db.query(TopicChipShortCode)
        .filter(TopicChipShortCode.short_code == topic_code)
        .first()
    )
    if not record:
        _not_found_route()
    return record


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/routes/app/subject/{subject_code}", response_model=AppRouteContext)
def resolve_subject_app_route(
    subject_code: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    subject_record = _get_subject_short_code_record(db, subject_code)
    require_subject_read(current_user, subject_record.subject)
    return {
        "subject_id": subject_record.subject_id,
        "subject_short_code": subject_record.short_code,
    }


@app.get(
    "/routes/app/subject/{subject_code}/module/{module_code}",
    response_model=AppRouteContext,
)
def resolve_module_app_route(
    subject_code: str,
    module_code: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    subject_record = _get_subject_short_code_record(db, subject_code)
    require_subject_read(current_user, subject_record.subject)
    module_record = _get_module_short_code_record(db, module_code)
    module = db.get(Module, module_record.module_id)
    if not module or module.subject_id != subject_record.subject_id:
        _not_found_route()
    return {
        "subject_id": subject_record.subject_id,
        "subject_short_code": subject_record.short_code,
        "module_id": module_record.module_id,
        "module_short_code": module_record.short_code,
    }


@app.get(
    "/routes/app/subject/{subject_code}/module/{module_code}/note-groups/{note_group_code}",
    response_model=AppRouteContext,
)
def resolve_note_group_app_route(
    subject_code: str,
    module_code: str,
    note_group_code: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    subject_record = _get_subject_short_code_record(db, subject_code)
    require_subject_read(current_user, subject_record.subject)
    module_record = _get_module_short_code_record(db, module_code)
    module = db.get(Module, module_record.module_id)
    if not module or module.subject_id != subject_record.subject_id:
        _not_found_route()
    note_group_record = _get_note_group_short_code_record(db, note_group_code)
    note_group = db.get(NoteGroup, note_group_record.note_group_id)
    if not note_group or note_group.module_id != module_record.module_id:
        _not_found_route()
    return {
        "subject_id": subject_record.subject_id,
        "subject_short_code": subject_record.short_code,
        "module_id": module_record.module_id,
        "module_short_code": module_record.short_code,
        "note_group_id": note_group_record.note_group_id,
        "note_group_short_code": note_group_record.short_code,
    }


@app.get(
    "/routes/app/subject/{subject_code}/module/{module_code}/topics/{topic_code}",
    response_model=AppRouteContext,
)
def resolve_topic_app_route(
    subject_code: str,
    module_code: str,
    topic_code: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    subject_record = _get_subject_short_code_record(db, subject_code)
    require_subject_read(current_user, subject_record.subject)
    module_record = _get_module_short_code_record(db, module_code)
    module = db.get(Module, module_record.module_id)
    if not module or module.subject_id != subject_record.subject_id:
        _not_found_route()
    topic_record = _get_topic_short_code_record(db, topic_code)
    topic = db.get(TopicChip, topic_record.topic_chip_id)
    if not topic or topic.module_id != module_record.module_id:
        _not_found_route()
    return {
        "subject_id": subject_record.subject_id,
        "subject_short_code": subject_record.short_code,
        "module_id": module_record.module_id,
        "module_short_code": module_record.short_code,
        "topic_id": topic_record.topic_chip_id,
        "topic_short_code": topic_record.short_code,
    }


@app.post("/modules/intent-chat", response_model=IntentChatResponse)
def module_intent_chat(
    payload: IntentChatRequest,
    current_user: User = Depends(require_creator),
):
    result = generate_module_intent_response(
        message=payload.message,
        history=[item.dict() for item in (payload.history or [])],
        current_title=payload.current_title,
        current_goal=payload.current_goal,
        current_scope=payload.current_scope,
        subject_title=payload.subject_title,
        subject_goal=payload.subject_goal,
        subject_scope=payload.subject_scope,
    )
    return {
        "assistant_message": result.get("assistant_message", ""),
        "title": result.get("title"),
        "goal": result.get("goal"),
        "scope": result.get("scope"),
    }


@app.get("/admin/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(User).order_by(User.email.asc()).all()


@app.put("/admin/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.app_role not in APP_ROLES:
        raise HTTPException(status_code=400, detail="Invalid app role")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.app_role = payload.app_role
    db.commit()
    db.refresh(user)
    return user


@app.get("/admin/subjects/public-requests", response_model=list[SubjectOut])
def list_public_subject_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    subjects = (
        db.query(Subject)
        .filter(Subject.visibility == SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
        .order_by(Subject.updated_at.asc())
        .all()
    )
    ensure_subject_short_codes(db, subjects)
    db.commit()
    for subject in subjects:
        _apply_current_user_access(subject, current_user)
    return subjects


@app.post("/admin/subjects/{subject_id}/approve-public", response_model=SubjectOut)
def approve_public_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if subject.visibility != SUBJECT_VISIBILITY_PUBLIC_REQUESTED:
        raise HTTPException(status_code=400, detail="Subject has not requested public visibility")
    subject.visibility = SUBJECT_VISIBILITY_PUBLIC
    ensure_subject_short_code(db, subject)
    db.commit()
    db.refresh(subject)
    return _apply_current_user_access(subject, current_user)


@app.post("/admin/subjects/{subject_id}/keep-private", response_model=SubjectOut)
def keep_subject_private(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if subject.visibility != SUBJECT_VISIBILITY_PUBLIC_REQUESTED:
        raise HTTPException(status_code=400, detail="Subject has not requested public visibility")
    subject.visibility = SUBJECT_VISIBILITY_PRIVATE
    ensure_subject_short_code(db, subject)
    db.commit()
    db.refresh(subject)
    return _apply_current_user_access(subject, current_user)


@app.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subjects = (
        db.query(Subject)
        .filter(readable_subject_filter(current_user))
        .order_by(Subject.created_at.desc())
        .all()
    )
    ensure_subject_short_codes(db, subjects)
    db.commit()
    for subject in subjects:
        _apply_current_user_access(subject, current_user)
    return subjects


@app.get("/public/subjects", response_model=list[PublicSubjectOut])
def list_public_subjects(db: Session = Depends(get_db)):
    subjects = (
        db.query(Subject)
        .filter(Subject.visibility == SUBJECT_VISIBILITY_PUBLIC)
        .order_by(Subject.title.asc())
        .all()
    )
    ensure_subject_short_codes(db, subjects)
    db.commit()
    return subjects


@app.post("/subjects", response_model=SubjectOut)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_creator),
):
    if current_user.app_role not in {APP_ROLE_CREATOR, APP_ROLE_ADMIN}:
        raise HTTPException(status_code=403, detail="Creator access required")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    subject = Subject(
        title=title,
        description=payload.description,
        goal=payload.goal.strip() if payload.goal else None,
        scope=payload.scope.strip() if payload.scope else None,
        owner_user_id=current_user.id,
    )
    db.add(subject)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject title must be unique")

    try:
        grant_owner_access(db, subject, current_user)
        ensure_subject_short_code(db, subject)
        db.commit()
        db.refresh(subject)
        return _apply_current_user_access(subject, current_user)
    except Exception:
        db.rollback()
        raise


@app.post("/subjects/intent-chat", response_model=IntentChatResponse)
def subject_intent_chat(
    payload: SubjectIntentChatPayload,
    current_user: User = Depends(require_creator),
):
    history = [item.model_dump() for item in (payload.history or [])]
    result = generate_subject_intent_response(
        payload.message,
        history,
        payload.current_title,
        payload.current_goal,
        payload.current_scope,
    )
    return {
        "assistant_message": result.get("assistant_message", ""),
        "title": result.get("title"),
        "goal": result.get("goal"),
        "scope": result.get("scope"),
    }


@app.post("/subjects/{subject_id}/request-public", response_model=SubjectOut)
def request_subject_public(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    if subject.visibility == SUBJECT_VISIBILITY_PUBLIC:
        raise HTTPException(status_code=400, detail="Subject is already public")
    subject.visibility = SUBJECT_VISIBILITY_PUBLIC_REQUESTED
    ensure_subject_short_code(db, subject)
    db.commit()
    db.refresh(subject)
    return _apply_current_user_access(subject, current_user)


@app.get("/subjects/{subject_id}/access", response_model=list[SubjectAccessOut])
def list_subject_access(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    return (
        db.query(SubjectAccess)
        .filter(SubjectAccess.subject_id == subject_id)
        .order_by(SubjectAccess.created_at.asc())
        .all()
    )


@app.get("/subjects/{subject_id}/sharing-users", response_model=list[UserOut])
def list_subject_sharing_users(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    return db.query(User).order_by(User.email.asc()).all()


@app.get("/subjects/{subject_id}/activity", response_model=list[SubjectActivityEventOut])
def list_subject_activity(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    events = (
        db.query(SubjectActivityEvent)
        .options(joinedload(SubjectActivityEvent.actor))
        .filter(SubjectActivityEvent.subject_id == subject_id)
        .order_by(SubjectActivityEvent.created_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize_subject_activity(event) for event in events]


@app.put("/subjects/{subject_id}/access/{user_id}", response_model=SubjectAccessOut)
def upsert_subject_access(
    subject_id: str,
    user_id: str,
    payload: SubjectAccessGrantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    if payload.access_level not in SUBJECT_ACCESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid subject access level")
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    assigning_owner = payload.access_level == SUBJECT_ACCESS_OWNER
    changing_current_owner_role = subject.owner_user_id == user_id and not assigning_owner
    if changing_current_owner_role:
        raise HTTPException(
            status_code=400,
            detail="Transfer ownership before changing the owner role",
        )
    if assigning_owner:
        require_subject_owner(current_user, subject)
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    grant = (
        db.query(SubjectAccess)
        .filter(SubjectAccess.subject_id == subject_id, SubjectAccess.user_id == user_id)
        .one_or_none()
    )
    if assigning_owner:
        previous_owner_id = subject.owner_user_id
        if previous_owner_id and previous_owner_id != user_id:
            previous_owner_grant = (
                db.query(SubjectAccess)
                .filter(
                    SubjectAccess.subject_id == subject_id,
                    SubjectAccess.user_id == previous_owner_id,
                )
                .one_or_none()
            )
            if previous_owner_grant:
                previous_owner_grant.access_level = SUBJECT_ACCESS_MAINTAINER
            else:
                db.add(
                    SubjectAccess(
                        subject_id=subject_id,
                        user_id=previous_owner_id,
                        access_level=SUBJECT_ACCESS_MAINTAINER,
                    )
                )
            db.flush()
        subject.owner_user_id = user_id
    if grant:
        grant.access_level = payload.access_level
    else:
        grant = SubjectAccess(
            subject_id=subject_id,
            user_id=user_id,
            access_level=payload.access_level,
        )
        db.add(grant)
    db.commit()
    db.refresh(grant)
    return grant


@app.delete("/subjects/{subject_id}/access/{user_id}")
def delete_subject_access(
    subject_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    if subject.owner_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot revoke the subject owner")
    grant = (
        db.query(SubjectAccess)
        .filter(SubjectAccess.subject_id == subject_id, SubjectAccess.user_id == user_id)
        .one_or_none()
    )
    if not grant:
        raise HTTPException(status_code=404, detail="Subject access grant not found")
    if grant.access_level == SUBJECT_ACCESS_OWNER:
        raise HTTPException(status_code=400, detail="Cannot revoke the subject owner")
    db.delete(grant)
    db.commit()
    return {"deleted": True}


@app.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_read(current_user, subject)
    ensure_subject_short_code(db, subject)
    db.commit()
    return _apply_current_user_access(subject, current_user)


@app.put("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: str,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_maintainer(current_user, subject)
    if (
        payload.title is None
        and payload.description is None
        and payload.goal is None
        and payload.scope is None
    ):
        raise HTTPException(status_code=400, detail="Provide fields to update")
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        subject.title = title
    if payload.description is not None:
        description = payload.description.strip()
        subject.description = description or None
    if payload.goal is not None:
        subject.goal = payload.goal.strip() or None
    if payload.scope is not None:
        subject.scope = payload.scope.strip() or None
    try:
        db.commit()
        db.refresh(subject)
        ensure_subject_short_code(db, subject)
        db.commit()
        return _apply_current_user_access(subject, current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject title must be unique")


@app.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_owner(current_user, subject)

    module_rows = db.query(Module.id).filter(Module.subject_id == subject_id).all()
    module_ids = [row[0] for row in module_rows]
    note_group_ids = []
    if module_ids:
        note_group_rows = (
            db.query(NoteGroup.id).filter(NoteGroup.module_id.in_(module_ids)).all()
        )
        note_group_ids = [row[0] for row in note_group_rows]

    study_card_ids = _delete_note_groups(db, note_group_ids)
    if module_ids:
        db.query(ModuleShortCode).filter(ModuleShortCode.module_id.in_(module_ids)).delete(
            synchronize_session=False
        )
        db.query(TopicChip).filter(TopicChip.module_id.in_(module_ids)).delete(
            synchronize_session=False
        )
        db.query(Module).filter(Module.id.in_(module_ids)).delete(synchronize_session=False)
    db.query(SubjectShortCode).filter(SubjectShortCode.subject_id == subject_id).delete(
        synchronize_session=False
    )
    db.delete(subject)
    db.commit()

    return {"deleted": True}


@app.get("/subjects/{subject_id}/modules", response_model=list[ModuleOut])
def list_subject_modules(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_read(current_user, subject)
    modules = (
        db.query(Module)
        .filter(Module.subject_id == subject_id)
        .order_by(Module.created_at.desc())
        .all()
    )
    ensure_module_short_codes(db, modules)
    db.commit()
    return modules


@app.post("/subjects/{subject_id}/modules", response_model=ModuleOut)
def create_subject_module(
    subject_id: str,
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    require_subject_edit(current_user, subject)
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    module = Module(
        subject_id=subject_id,
        title=title,
        description=payload.description,
        goal=payload.goal.strip() if payload.goal else None,
        scope=payload.scope.strip() if payload.scope else None,
        settings_json=json.dumps(DEFAULT_MODULE_SETTINGS),
    )
    db.add(module)
    try:
        db.flush()
        ensure_module_short_code(db, module)
        _record_subject_activity(
            db,
            subject_id=subject_id,
            actor=current_user,
            event_type=SUBJECT_ACTIVITY_CREATED,
            entity_type=SUBJECT_ACTIVITY_MODULE,
            entity_id=module.id,
            entity_title=module.title,
        )
        db.commit()
        db.refresh(module)
        return module
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module title must be unique")


@app.get("/modules", response_model=list[ModuleOut])
def list_modules(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    modules = (
        db.query(Module)
        .join(Subject, Module.subject_id == Subject.id)
        .filter(readable_subject_filter(current_user))
        .order_by(Module.created_at.desc())
        .all()
    )
    ensure_module_short_codes(db, modules)
    db.commit()
    return modules


@app.post("/modules", response_model=ModuleOut)
def create_module(
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    raise HTTPException(
        status_code=400, detail="Use /subjects/{subject_id}/modules instead"
    )


@app.get("/modules/{module_id}", response_model=ModuleOut)
def get_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    module = require_module_read(db, current_user, module_id)
    ensure_module_short_code(db, module)
    db.commit()
    return module


@app.get("/modules/{module_id}/mind-map", response_model=MindMapResponse)
def get_module_mind_map(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_read(db, current_user, module_id)
    return build_module_mind_map_response(db, module_id)


@app.put("/modules/{module_id}", response_model=ModuleOut)
def update_module(
    module_id: str,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    module = require_module_edit(db, current_user, module_id)
    if (
        payload.title is None
        and payload.description is None
        and payload.goal is None
        and payload.scope is None
        and payload.settings is None
    ):
        raise HTTPException(status_code=400, detail="Provide fields to update")
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        module.title = title
    if payload.description is not None:
        description = payload.description.strip()
        module.description = description or None
    if payload.goal is not None:
        module.goal = payload.goal.strip() or None
    if payload.scope is not None:
        module.scope = payload.scope.strip() or None
    if payload.settings is not None:
        if not isinstance(payload.settings, dict):
            raise HTTPException(status_code=400, detail="Settings must be an object")
        next_settings = dict(module.settings)
        for key, value in payload.settings.items():
            if key == "auto_question_count":
                try:
                    count = int(value)
                except (TypeError, ValueError):
                    raise HTTPException(
                        status_code=400, detail="Auto question count must be a number"
                    )
                if count < 1:
                    raise HTTPException(
                        status_code=400, detail="Auto question count must be at least 1"
                    )
                next_settings[key] = count
            elif key == "additional_generation_instructions":
                if value is None:
                    next_settings[key] = ""
                elif not isinstance(value, str):
                    raise HTTPException(
                        status_code=400,
                        detail="Additional generation instructions must be text",
                    )
                else:
                    trimmed = value.strip()
                    _validate_additional_instructions(trimmed)
                    next_settings[key] = trimmed
            else:
                next_settings[key] = value
        try:
            module.settings_json = json.dumps(next_settings)
        except TypeError:
            raise HTTPException(status_code=400, detail="Settings must be JSON-serializable")
    try:
        db.commit()
        db.refresh(module)
        ensure_module_short_code(db, module)
        db.commit()
        return module
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module title must be unique")


@app.delete("/modules/{module_id}")
def delete_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    module = require_module_edit(db, current_user, module_id)
    subject_id = module.subject_id
    module_title = module.title

    note_group_rows = db.query(NoteGroup.id).filter(NoteGroup.module_id == module_id).all()
    note_group_ids = [row[0] for row in note_group_rows]

    study_card_ids = _delete_note_groups(db, note_group_ids)
    db.query(ModuleShortCode).filter(ModuleShortCode.module_id == module_id).delete(
        synchronize_session=False
    )
    db.query(TopicChip).filter(TopicChip.module_id == module_id).delete(
        synchronize_session=False
    )
    _record_subject_activity(
        db,
        subject_id=subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_DELETED,
        entity_type=SUBJECT_ACTIVITY_MODULE,
        entity_id=module_id,
        entity_title=module_title,
    )
    db.delete(module)
    db.commit()

    return {"deleted": True}


@app.get("/modules/{module_id}/note-groups", response_model=list[NoteGroupOut])
def list_note_groups(
    module_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_read(db, current_user, module_id)

    query = db.query(NoteGroup).filter(NoteGroup.module_id == module_id)
    if chip_ids:
        parsed_ids = [chip_id for chip_id in chip_ids.split(",") if chip_id]
        if parsed_ids:
            query = (
                query.join(note_group_topic_chips)
                .filter(note_group_topic_chips.c.chip_id.in_(parsed_ids))
                .distinct()
            )

    sort_nulls_last = case((NoteGroup.sort_order.is_(None), 1), else_=0)
    note_groups = (
        query.order_by(
            sort_nulls_last,
            NoteGroup.sort_order.asc(),
            NoteGroup.created_at.asc(),
        )
        .all()
    )
    ensure_note_group_short_codes(db, note_groups)
    db.commit()
    return note_groups


@app.get("/modules/{module_id}/overview", response_model=ModuleOverviewResponse)
def get_module_overview(
    module_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_read(db, current_user, module_id)

    sort_nulls_last = case((NoteGroup.sort_order.is_(None), 1), else_=0)
    note_groups = (
        db.query(NoteGroup)
        .filter(NoteGroup.module_id == module_id)
        .order_by(
            sort_nulls_last,
            NoteGroup.sort_order.asc(),
            NoteGroup.created_at.asc(),
        )
        .all()
    )
    ensure_note_group_short_codes(db, note_groups)
    db.commit()
    note_group_ids = [group.id for group in note_groups]
    now = datetime.now(timezone.utc)

    study_count_by_group: Counter[str] = Counter()
    cards_by_group: defaultdict[str, list[QuestionCard]] = defaultdict(list)
    filtered_cards: list[QuestionCard] = []
    state_by_card_id: dict[str, QuestionCardLearningState] = {}

    if note_group_ids:
        chip_id_list = _parse_chip_ids(chip_ids)
        study_card_query = db.query(StudyCard.id, StudyCard.note_group_id).filter(
            StudyCard.note_group_id.in_(note_group_ids)
        )
        if chip_id_list:
            study_card_query = (
                study_card_query.join(
                    study_card_topic_chips,
                    StudyCard.id == study_card_topic_chips.c.study_card_id,
                )
                .filter(study_card_topic_chips.c.chip_id.in_(chip_id_list))
                .distinct()
            )
        study_card_rows = study_card_query.all()
        study_count_by_group = Counter(row.note_group_id for row in study_card_rows)
        allowed_study_ids = {row.id for row in study_card_rows} if chip_id_list else None

        question_cards = (
            db.query(QuestionCard)
            .filter(QuestionCard.note_group_id.in_(note_group_ids))
            .order_by(QuestionCard.due_at.asc())
            .all()
        )
        if allowed_study_ids is not None:
            question_cards = [
                card
                for card in question_cards
                if any(ref in allowed_study_ids for ref in _question_card_refs(card))
            ]
        filtered_cards = question_cards
        state_by_card_id = _question_card_learning_state_map(db, filtered_cards, current_user)
        for card in filtered_cards:
            cards_by_group[card.note_group_id].append(card)

    note_group_stats = []
    module_stats = {
        "study_count": 0,
        "question_count": 0,
        "due_count": 0,
        "stale_count": 0,
    }
    for group in note_groups:
        group_cards = cards_by_group[group.id]
        timeline = _build_question_timeline(group_cards, now, state_by_card_id)
        stale_count = sum(1 for card in group_cards if card.stale)
        stats = {
            "id": group.id,
            "title": group.title,
            "study_count": study_count_by_group[group.id],
            "question_count": len(group_cards),
            "due_count": timeline["due"],
            "stale_count": stale_count,
            "timeline": timeline,
        }
        note_group_stats.append(stats)
        module_stats["study_count"] += stats["study_count"]
        module_stats["question_count"] += stats["question_count"]
        module_stats["due_count"] += stats["due_count"]
        module_stats["stale_count"] += stats["stale_count"]

    return {
        "note_groups": note_groups,
        "note_group_stats": note_group_stats,
        "module_stats": module_stats,
        "module_timeline": _build_question_timeline(filtered_cards, now, state_by_card_id),
    }


@app.post("/note-groups/source-check", response_model=NoteGroupSourceCheckResponse)
def check_note_group_source(
    payload: NoteGroupSourceCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    normalized = _normalize_source_text(payload.source or "")
    if not normalized:
        raise HTTPException(status_code=400, detail="Unique ID cannot be empty")
    matches = (
        db.query(NoteGroup)
        .join(Module, NoteGroup.module_id == Module.id)
        .join(Subject, Module.subject_id == Subject.id)
        .filter(NoteGroup.source_normalized == normalized)
        .filter(readable_subject_filter(current_user))
        .order_by(NoteGroup.created_at.asc())
        .all()
    )
    return {
        "normalized": normalized,
        "duplicates": [
            {
                "id": group.id,
                "module_id": group.module_id,
                "title": group.title,
                "created_at": group.created_at,
            }
            for group in matches
        ],
    }


@app.put("/modules/{module_id}/note-groups/order")
def update_note_group_order(
    module_id: str,
    payload: NoteGroupOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_module_edit(db, current_user, module_id)
    note_group_ids = [value for value in payload.note_group_ids if value]
    if not note_group_ids:
        raise HTTPException(status_code=400, detail="Note group ids cannot be empty")

    groups = (
        db.query(NoteGroup)
        .filter(NoteGroup.module_id == module_id, NoteGroup.id.in_(note_group_ids))
        .all()
    )
    if len(groups) != len(set(note_group_ids)):
        raise HTTPException(status_code=400, detail="Note group ids mismatch")

    group_by_id = {group.id: group for group in groups}
    for index, group_id in enumerate(note_group_ids):
        group_by_id[group_id].sort_order = index
    db.commit()
    return {"updated": len(note_group_ids)}


@app.post("/note-groups/auto", response_model=JobOut)
def auto_create_note_group(
    payload: NoteGroupAutoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_module_edit(db, current_user, payload.module_id)
    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    source_raw = payload.source.strip()
    source_normalized = _normalize_source_text(source_raw)
    if not source_normalized:
        raise HTTPException(status_code=400, detail="Unique ID cannot be empty")

    if payload.additional_generation_instructions is None:
        additional_instructions = ""
    else:
        additional_instructions = payload.additional_generation_instructions
    if additional_instructions is None:
        additional_instructions = ""
    if not isinstance(additional_instructions, str):
        raise HTTPException(
            status_code=400,
            detail="Additional generation instructions must be text",
        )
    additional_instructions = additional_instructions.strip()
    _validate_additional_instructions(additional_instructions)
    if payload.additional_generation_instructions is None:
        additional_instructions = ""
    else:
        additional_instructions = payload.additional_generation_instructions
    if additional_instructions is None:
        additional_instructions = ""
    if not isinstance(additional_instructions, str):
        raise HTTPException(
            status_code=400,
            detail="Additional generation instructions must be text",
        )
    additional_instructions = additional_instructions.strip()
    _validate_additional_instructions(additional_instructions)

    note_group = NoteGroup(
        module_id=payload.module_id,
        source=source_raw,
        source_normalized=source_normalized,
        raw_text=raw_text,
        additional_generation_instructions=additional_instructions,
        generation_status="queued",
        sort_order=_next_note_group_sort_order(db, payload.module_id),
    )
    db.add(note_group)
    db.flush()
    ensure_note_group_short_code(db, note_group)
    job = Job(
        type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
        note_group_id=note_group.id,
        payload_json=None,
    )
    db.add(job)
    note_group.title = job.id
    _record_subject_activity(
        db,
        subject_id=note_group.module.subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_CREATED,
        entity_type=SUBJECT_ACTIVITY_NOTE_GROUP,
        entity_id=note_group.id,
        entity_title=source_raw or note_group.title,
    )
    db.commit()
    db.refresh(job)

    enqueue_auto_job(job.id)
    return job


@app.put("/note-groups/{note_group_id}/title", response_model=NoteGroupOut)
def update_note_group_title(
    note_group_id: str,
    payload: NoteGroupTitleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    note_group.title = title
    note_group.suggested_titles_json = None
    db.commit()
    db.refresh(note_group)
    ensure_note_group_short_code(db, note_group)
    db.commit()
    return note_group


@app.get("/modules/{module_id}/topic-chips", response_model=list[TopicChipOut])
def list_topic_chips(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_read(db, current_user, module_id)
    topics = (
        db.query(TopicChip)
        .filter(TopicChip.module_id == module_id)
        .order_by(TopicChip.label.asc())
        .all()
    )
    ensure_topic_chip_short_codes(db, topics)
    db.commit()
    return topics


@app.post("/modules/{module_id}/topic-chips", response_model=TopicChipOut)
def create_topic_chip(
    module_id: str,
    payload: TopicChipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_module_edit(db, current_user, module_id)
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label cannot be empty")
    _validate_chip_label(label)
    chip = TopicChip(module_id=module_id, label=label, description=payload.description)
    db.add(chip)
    db.commit()
    db.refresh(chip)
    ensure_topic_chip_short_code(db, chip)
    db.commit()
    return chip


@app.get("/topics/{topic_id}", response_model=TopicChipOut)
def get_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, topic_id)
    ensure_topic_chip_short_code(db, topic)
    db.commit()
    return topic


@app.put("/topics/{topic_id}", response_model=TopicChipOut)
def update_topic(
    topic_id: str,
    payload: TopicChipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    topic = require_topic_edit(db, current_user, topic_id)
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label cannot be empty")
    _validate_chip_label(label)
    topic.label = label
    topic.description = payload.description
    db.commit()
    db.refresh(topic)
    ensure_topic_chip_short_code(db, topic)
    db.commit()
    return topic


@app.delete("/topics/{topic_id}")
def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    topic = require_topic_edit(db, current_user, topic_id)

    db.execute(
        study_card_topic_chips.delete().where(
            study_card_topic_chips.c.chip_id == topic_id
        )
    )
    db.execute(
        note_group_topic_chips.delete().where(
            note_group_topic_chips.c.chip_id == topic_id
        )
    )
    db.query(TopicChipShortCode).filter(
        TopicChipShortCode.topic_chip_id == topic_id
    ).delete(synchronize_session=False)
    db.delete(topic)
    db.commit()
    return {"deleted": True}


def _topic_allowed_study_ids(db: Session, topic: TopicChip) -> list[str]:
    rows = (
        db.query(StudyCard.id)
        .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
        .join(
            study_card_topic_chips,
            StudyCard.id == study_card_topic_chips.c.study_card_id,
        )
        .filter(
            NoteGroup.module_id == topic.module_id,
            study_card_topic_chips.c.chip_id == topic.id,
        )
        .order_by(StudyCard.created_at.asc())
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def _topic_question_cards(db: Session, topic: TopicChip) -> list[QuestionCard]:
    allowed_study_ids = set(_topic_allowed_study_ids(db, topic))
    if not allowed_study_ids:
        return []
    cards = (
        db.query(QuestionCard)
        .join(NoteGroup, QuestionCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == topic.module_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    return [
        card
        for card in cards
        if any(ref in allowed_study_ids for ref in _question_card_refs(card))
    ]


@app.get("/topics/{topic_id}/study-cards", response_model=StudyCardList)
def list_topic_study_cards(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, topic_id)
    cards = (
        db.query(StudyCard)
        .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
        .join(
            study_card_topic_chips,
            StudyCard.id == study_card_topic_chips.c.study_card_id,
        )
        .filter(
            NoteGroup.module_id == topic.module_id,
            study_card_topic_chips.c.chip_id == topic_id,
        )
        .order_by(StudyCard.created_at.asc())
        .distinct()
        .all()
    )
    return {"study_cards": cards}


@app.get("/topics/{topic_id}/question-cards", response_model=QuestionCardList)
def list_topic_question_cards(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, topic_id)
    cards = _topic_question_cards(db, topic)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}


@app.get(
    "/topics/{topic_id}/question-cards/timeline",
    response_model=QuestionTimelineResponse,
)
def get_topic_question_timeline(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, topic_id)
    cards = _topic_question_cards(db, topic)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    timeline = _build_question_timeline(cards, datetime.now(timezone.utc), state_by_card_id)
    return {
        "timeline": timeline,
        "question_count": len(cards),
        "stale_count": sum(1 for card in cards if card.stale),
    }


@app.get("/topics/{topic_id}/question-cards/review", response_model=QuestionCardList)
def list_topic_review_question_cards(
    topic_id: str,
    mode: str = Query(default="due"),
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    topic = require_topic_study(db, current_user, topic_id)
    now = datetime.now(timezone.utc)
    cards = _topic_question_cards(db, topic)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    cards = _review_cards_for_mode(cards, mode, limit, state_by_card_id, now)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}


@app.post("/note-groups/{note_group_id}/topic-chips", response_model=list[TopicChipOut])
def attach_topic_chips(
    note_group_id: str,
    payload: TopicChipAttach,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    if not payload.chip_ids:
        return note_group.topic_chips

    chips = (
        db.query(TopicChip)
        .filter(TopicChip.id.in_(payload.chip_ids))
        .all()
    )
    for chip in chips:
        if chip.module_id != note_group.module_id:
            continue
        if chip not in note_group.topic_chips:
            note_group.topic_chips.append(chip)
    db.commit()
    return note_group.topic_chips


@app.delete(
    "/note-groups/{note_group_id}/topic-chips/{chip_id}",
    response_model=list[TopicChipOut],
)
def detach_topic_chip(
    note_group_id: str,
    chip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    chip = db.get(TopicChip, chip_id)
    if not chip:
        raise HTTPException(status_code=404, detail="Topic chip not found")
    if chip in note_group.topic_chips:
        note_group.topic_chips.remove(chip)
        db.commit()
    return note_group.topic_chips


@app.get("/note-groups/{note_group_id}", response_model=NoteGroupOut)
def get_note_group(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    note_group = (
        db.query(NoteGroup)
        .options(joinedload(NoteGroup.module))
        .filter(NoteGroup.id == note_group_id)
        .first()
    )
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    require_subject_read(current_user, note_group.module.subject)
    ensure_note_group_short_code(db, note_group)
    db.commit()
    return note_group


def _active_mind_map_generation_job(db: Session, note_group_id: str, *, for_update: bool = False) -> Job | None:
    query = (
        db.query(Job)
        .filter(
            Job.note_group_id == note_group_id,
            Job.type == JOB_TYPE_MIND_MAP_GENERATION,
            Job.status.in_(MIND_MAP_ACTIVE_JOB_STATUSES),
        )
        .order_by(Job.created_at.desc(), Job.id.desc())
    )
    if for_update:
        query = query.with_for_update()
    return query.first()


def _mind_map_generation_job_by_id_for_update(db: Session, job_id: str) -> Job | None:
    return (
        db.query(Job)
        .filter(Job.id == job_id, Job.type == JOB_TYPE_MIND_MAP_GENERATION)
        .with_for_update()
        .populate_existing()
        .first()
    )


def _latest_mind_map_generation_job_for_update(db: Session, note_group_id: str) -> Job | None:
    return (
        db.query(Job)
        .filter(
            Job.note_group_id == note_group_id,
            Job.type == JOB_TYPE_MIND_MAP_GENERATION,
        )
        .order_by(Job.created_at.desc(), Job.id.desc())
        .with_for_update()
        .populate_existing()
        .first()
    )


def _is_stale_mind_map_generation_job(job: Job) -> bool:
    if job.status != "running":
        return False
    last_seen_at = job.updated_at or job.created_at
    if last_seen_at is None:
        return False
    return datetime.utcnow() - last_seen_at > MIND_MAP_RUNNING_JOB_TIMEOUT


def _resolve_existing_mind_map_generation_job(
    db: Session,
    background_tasks: BackgroundTasks,
    existing_job: Job | None,
) -> Job | None:
    if not existing_job:
        return None
    if existing_job.status == "queued":
        background_tasks.add_task(run_mind_map_generation, existing_job.id)
        return existing_job
    if existing_job.status == "running":
        if not _is_stale_mind_map_generation_job(existing_job):
            return existing_job
        existing_job.status = "failed"
        existing_job.error = STALE_MIND_MAP_JOB_ERROR
        db.commit()
        return None
    if existing_job.status == "completed":
        return existing_job
    return None


def _queue_mind_map_generation_job(
    db: Session,
    background_tasks: BackgroundTasks,
    note_group_id: str,
) -> Job:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    job = Job(type=JOB_TYPE_MIND_MAP_GENERATION, note_group_id=note_group_id)
    db.add(job)
    note_group.mind_map_status = "queued"
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_mind_map_generation, job.id)
    return job


def _queue_or_resolve_mind_map_generation_job(
    db: Session,
    background_tasks: BackgroundTasks,
    note_group_id: str,
) -> Job:
    for _attempt in range(3):
        try:
            return _queue_mind_map_generation_job(db, background_tasks, note_group_id)
        except IntegrityError:
            db.rollback()
            latest_job = _latest_mind_map_generation_job_for_update(db, note_group_id)
            resolved_job = _resolve_existing_mind_map_generation_job(db, background_tasks, latest_job)
            if resolved_job:
                return resolved_job
    latest_job = _latest_mind_map_generation_job_for_update(db, note_group_id)
    resolved_job = _resolve_existing_mind_map_generation_job(db, background_tasks, latest_job)
    if resolved_job:
        return resolved_job
    raise HTTPException(status_code=409, detail="Unable to queue Concept Mind Map generation")


@app.post("/note-groups/{note_group_id}/mind-map/generate", response_model=JobOut)
def generate_note_group_mind_map(
    note_group_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    active_job = _active_mind_map_generation_job(db, note_group_id)
    existing_job = (
        _mind_map_generation_job_by_id_for_update(db, active_job.id)
        if active_job
        else None
    )
    resolved_job = _resolve_existing_mind_map_generation_job(db, background_tasks, existing_job)
    if resolved_job:
        return resolved_job

    return _queue_or_resolve_mind_map_generation_job(db, background_tasks, note_group_id)


@app.get("/note-groups/{note_group_id}/mind-map", response_model=MindMapResponse)
def get_note_group_mind_map(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_note_group_read(db, current_user, note_group_id)
    return build_note_group_mind_map_response(db, note_group_id)


@app.delete("/note-groups/{note_group_id}")
def delete_note_group(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    subject_id = note_group.module.subject_id
    note_group_title = note_group.title or note_group.source or note_group.id

    study_card_ids = _delete_note_groups(db, [note_group_id])
    _record_subject_activity(
        db,
        subject_id=subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_DELETED,
        entity_type=SUBJECT_ACTIVITY_NOTE_GROUP,
        entity_id=note_group_id,
        entity_title=note_group_title,
    )
    db.commit()

    return {"deleted": True}


@app.get("/jobs/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    job = require_job_read(db, current_user, job_id)
    return job


@app.get("/jobs", response_model=list[JobOut])
def list_jobs(
    type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    module_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    query = db.query(Job)
    if module_id:
        module = require_module_read(db, current_user, module_id)
        require_subject_maintainer(current_user, module.subject)
        query = query.join(NoteGroup, Job.note_group_id == NoteGroup.id).filter(
            NoteGroup.module_id == module_id
        )
    elif current_user.app_role != APP_ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    if type:
        query = query.filter(Job.type == type)
    if status:
        statuses = [value.strip() for value in status.split(",") if value.strip()]
        if statuses:
            query = query.filter(Job.status.in_(statuses))
    return query.order_by(Job.created_at.desc()).all()


@app.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    job = require_job_edit(db, current_user, job_id)
    if job.type != JOB_TYPE_NOTE_GROUP_AUTO_GENERATION:
        raise HTTPException(status_code=400, detail="Only auto jobs can be cancelled")
    if job.status in {"completed", "failed", "cancelled"}:
        return job

    if job.status == "queued":
        remove_auto_job(job.id)
    job.status = "cancelled"
    if job.note_group_id:
        note_group = db.get(NoteGroup, job.note_group_id)
        if note_group:
            note_group.generation_status = "cancelled"
    db.commit()
    db.refresh(job)
    return job


@app.post("/jobs/{job_id}/retry", response_model=JobOut)
def retry_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    job = require_job_edit(db, current_user, job_id)
    if job.type != JOB_TYPE_NOTE_GROUP_AUTO_GENERATION:
        raise HTTPException(status_code=400, detail="Only auto jobs can be retried")
    if job.status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Job is not retryable")
    note_group = job.note_group
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")

    study_card_ids = _reset_note_group_for_retry(db, note_group)
    new_job = Job(
        type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
        note_group_id=note_group.id,
        payload_json=job.payload_json,
    )
    db.add(new_job)
    db.flush()
    note_group.title = new_job.id
    db.commit()
    db.refresh(new_job)

    enqueue_auto_job(new_job.id)
    return new_job


@app.get("/note-groups/{note_group_id}/study-cards", response_model=StudyCardList)
def list_study_cards(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_note_group_read(db, current_user, note_group_id)
    cards = (
        db.query(StudyCard)
        .filter(StudyCard.note_group_id == note_group_id)
        .order_by(StudyCard.created_at.asc())
        .all()
    )
    return {"study_cards": cards}


@app.get("/note-groups/{note_group_id}/card-table", response_model=NoteGroupCardTableResponse)
def get_note_group_card_table(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_note_group_read(db, current_user, note_group_id)

    study_cards = (
        db.query(StudyCard)
        .filter(StudyCard.note_group_id == note_group_id)
        .order_by(StudyCard.created_at.asc())
        .all()
    )
    question_cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .order_by(QuestionCard.created_at.asc())
        .all()
    )
    performance_by_question_id = {
        row["id"]: row
        for row in build_question_card_performance(
            db,
            note_group_id,
            range_value="all",
            sort="success_rate",
            direction="asc",
            mastery="all",
            stale=None,
            reviewed="all",
            attention=False,
            chip_ids=None,
            user_id=current_user.id if current_user else "__anonymous__",
        )["rows"]
    }

    questions_by_study_id = defaultdict(list)
    unlinked_question_count = 0
    for question_card in question_cards:
        refs = _question_card_refs(question_card)
        if not refs:
            unlinked_question_count += 1
            continue
        performance = performance_by_question_id.get(question_card.id, {})
        for study_card_id in refs:
            questions_by_study_id[study_card_id].append(
                {
                    "id": question_card.id,
                    "prompt": question_card.prompt,
                    "mastery": performance.get("mastery"),
                    "mastery_tier": performance.get("mastery_tier", "unknown"),
                    "success_rate": performance.get("success_rate"),
                    "median_response_time_ms": performance.get("median_response_time_ms"),
                    "reviews": performance.get("reviews", 0),
                    "due_at": performance.get("due_at"),
                }
            )

    return {
        "rows": [
            {
                "study_card": {
                    "id": study_card.id,
                    "title": study_card.title,
                },
                "question_cards": questions_by_study_id.get(study_card.id, []),
            }
            for study_card in study_cards
        ],
        "unlinked_question_count": unlinked_question_count,
    }


@app.get("/study-cards/{study_card_id}", response_model=StudyCardOut)
def get_study_card(
    study_card_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    card = require_study_card_read(db, current_user, study_card_id)
    return card


@app.post("/note-groups/{note_group_id}/study-cards", response_model=StudyCardOut)
def create_study_card(
    note_group_id: str,
    payload: StudyCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    card = StudyCard(
        note_group_id=note_group_id,
        title=payload.title,
        content=payload.content,
    )
    if payload.chip_ids:
        chips = (
            db.query(TopicChip)
            .filter(
                TopicChip.id.in_(payload.chip_ids),
                TopicChip.module_id == note_group.module_id,
            )
            .all()
        )
        card.topic_chips = chips
    db.add(card)
    try:
        db.flush()
        _record_subject_activity(
            db,
            subject_id=note_group.module.subject_id,
            actor=current_user,
            event_type=SUBJECT_ACTIVITY_CREATED,
            entity_type=SUBJECT_ACTIVITY_STUDY_CARD,
            entity_id=card.id,
            entity_title=card.title or card.content[:120],
        )
        _upsert_study_card_embedding(card, note_group.module_id)
        mark_note_group_mind_map_stale(db, note_group.id)
        db.commit()
        db.refresh(card)
        return card
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.put("/study-cards/{study_card_id}", response_model=StudyCardOut)
def update_study_card(
    study_card_id: str,
    payload: StudyCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = require_study_card_edit(db, current_user, study_card_id)
    note_group = card.note_group
    if payload.title is not None:
        card.title = payload.title
    if payload.content is not None:
        if not payload.content.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        card.content = payload.content
    if payload.chip_ids is not None:
        chips = (
            db.query(TopicChip)
            .filter(
                TopicChip.id.in_(payload.chip_ids),
                TopicChip.module_id == note_group.module_id,
            )
            .all()
        )
        card.topic_chips = chips
    try:
        db.flush()
        _upsert_study_card_embedding(card, note_group.module_id)
        mark_note_group_mind_map_stale(db, note_group.id)
        db.commit()
        db.refresh(card)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    _mark_question_cards_stale(db, note_group.id, card.id)
    return card


@app.delete("/study-cards/{study_card_id}")
def delete_study_card(
    study_card_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = require_study_card_edit(db, current_user, study_card_id)
    note_group_id = card.note_group_id
    subject_id = card.note_group.module.subject_id
    card_id = card.id
    card_title = card.title or card.content[:120]
    delete_study_card_embeddings(db, [card_id])
    _record_subject_activity(
        db,
        subject_id=subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_DELETED,
        entity_type=SUBJECT_ACTIVITY_STUDY_CARD,
        entity_id=card_id,
        entity_title=card_title,
    )
    db.delete(card)
    mark_note_group_mind_map_stale(db, note_group_id)
    db.commit()
    _mark_question_cards_stale(db, note_group_id, card_id)
    return {"deleted": True}


@app.post(
    "/note-groups/{note_group_id}/study-cards/review",
    response_model=StudyCardReviewResult,
)
def review_study_cards(
    note_group_id: str,
    payload: StudyCardReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_note_group_edit(db, current_user, note_group_id)

    if not payload.irrelevant_ids:
        return {"deleted": 0}

    cards = (
        db.query(StudyCard)
        .filter(
            StudyCard.note_group_id == note_group_id,
            StudyCard.id.in_(payload.irrelevant_ids),
        )
        .all()
    )
    if not cards:
        return {"deleted": 0}

    ids_to_delete = [card.id for card in cards]
    delete_study_card_embeddings(db, ids_to_delete)
    for card in cards:
        db.delete(card)
    mark_note_group_mind_map_stale(db, note_group_id)
    db.commit()

    return {"deleted": len(ids_to_delete)}


@app.post(
    "/note-groups/{note_group_id}/question-cards/generate",
    response_model=JobOut,
)
def generate_question_cards(
    note_group_id: str,
    payload: QuestionCardGenerate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_note_group_edit(db, current_user, note_group_id)

    job = Job(type=JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION, note_group_id=note_group_id)
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        run_question_card_generation,
        job.id,
        payload.count or 6,
        payload.difficulty or "mixed",
    )

    return job


@app.get("/note-groups/{note_group_id}/question-cards", response_model=QuestionCardList)
def list_question_cards(
    note_group_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_note_group_read(db, current_user, note_group_id)
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .order_by(QuestionCard.created_at.asc())
        .all()
    )
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}


@app.get(
    "/note-groups/{note_group_id}/question-cards/timeline",
    response_model=QuestionTimelineResponse,
)
def get_note_group_question_timeline(
    note_group_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_note_group_read(db, current_user, note_group_id)
    now = datetime.now(timezone.utc)
    chip_id_list = _parse_chip_ids(chip_ids)
    allowed_study_ids: Optional[set[str]] = None
    if chip_id_list:
        study_card_rows = (
            db.query(StudyCard.id)
            .join(
                study_card_topic_chips,
                StudyCard.id == study_card_topic_chips.c.study_card_id,
            )
            .filter(
                StudyCard.note_group_id == note_group_id,
                study_card_topic_chips.c.chip_id.in_(chip_id_list),
            )
            .distinct()
            .all()
        )
        allowed_study_ids = {row[0] for row in study_card_rows}
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    if allowed_study_ids is not None:
        cards = [
            card
            for card in cards
            if any(ref in allowed_study_ids for ref in _question_card_refs(card))
        ]
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    timeline = _build_question_timeline(cards, now, state_by_card_id)
    stale_count = sum(1 for card in cards if card.stale)
    return {
        "timeline": timeline,
        "question_count": len(cards),
        "stale_count": stale_count,
    }


@app.get("/note-groups/{note_group_id}/progress", response_model=NoteGroupProgressResponse)
def get_note_group_progress(
    note_group_id: str,
    range: str = Query(default="30d"),
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_note_group_read(db, current_user, note_group_id)
    chip_id_list = _parse_chip_ids(chip_ids)
    return build_note_group_progress(db, note_group_id, range, chip_id_list, current_user.id)


@app.get(
    "/note-groups/{note_group_id}/question-card-performance",
    response_model=QuestionCardPerformanceResponse,
)
def get_note_group_question_card_performance(
    note_group_id: str,
    range: str = Query(default="30d"),
    sort: str = Query(default="success_rate"),
    direction: str = Query(default="asc"),
    mastery: str = Query(default="all"),
    stale: Optional[bool] = Query(default=None),
    reviewed: str = Query(default="all"),
    attention: bool = Query(default=False),
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_note_group_read(db, current_user, note_group_id)
    chip_id_list = _parse_chip_ids(chip_ids)
    return build_question_card_performance(
        db,
        note_group_id,
        range,
        sort,
        direction,
        mastery,
        stale,
        reviewed,
        attention,
        chip_id_list,
        current_user.id,
    )


@app.get("/note-groups/{note_group_id}/question-cards/review", response_model=QuestionCardList)
def list_review_question_cards(
    note_group_id: str,
    mode: str = Query(default="due"),
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_note_group_study(db, current_user, note_group_id)
    now = datetime.now(timezone.utc)
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    cards = _review_cards_for_mode(cards, mode, limit, state_by_card_id, now)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}


@app.get(
    "/modules/{module_id}/question-cards/timeline",
    response_model=QuestionTimelineResponse,
)
def get_module_question_timeline(
    module_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_read(db, current_user, module_id)
    now = datetime.now(timezone.utc)
    chip_id_list = _parse_chip_ids(chip_ids)
    allowed_study_ids: Optional[set[str]] = None
    if chip_id_list:
        study_card_rows = (
            db.query(StudyCard.id)
            .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
            .join(
                study_card_topic_chips,
                StudyCard.id == study_card_topic_chips.c.study_card_id,
            )
            .filter(
                NoteGroup.module_id == module_id,
                study_card_topic_chips.c.chip_id.in_(chip_id_list),
            )
            .distinct()
            .all()
        )
        allowed_study_ids = {row[0] for row in study_card_rows}
    cards = (
        db.query(QuestionCard)
        .join(NoteGroup, QuestionCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == module_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    if allowed_study_ids is not None:
        cards = [
            card
            for card in cards
            if any(ref in allowed_study_ids for ref in _question_card_refs(card))
        ]
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    timeline = _build_question_timeline(cards, now, state_by_card_id)
    stale_count = sum(1 for card in cards if card.stale)
    return {
        "timeline": timeline,
        "question_count": len(cards),
        "stale_count": stale_count,
    }


@app.get("/modules/{module_id}/question-cards/review", response_model=QuestionCardList)
def list_module_review_question_cards(
    module_id: str,
    mode: str = Query(default="due"),
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    require_module_study(db, current_user, module_id)
    now = datetime.now(timezone.utc)
    cards = (
        db.query(QuestionCard)
        .join(NoteGroup, QuestionCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == module_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    cards = _review_cards_for_mode(cards, mode, limit, state_by_card_id, now)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}


@app.post("/note-groups/{note_group_id}/question-cards", response_model=QuestionCardOut)
def create_question_card(
    note_group_id: str,
    payload: QuestionCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    note_group = require_note_group_edit(db, current_user, note_group_id)
    if payload.type not in {"mcq", "multi"}:
        raise HTTPException(status_code=400, detail="Invalid question type")
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    if not payload.options or len(payload.options) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two options")
    if not payload.correct_option_indices:
        raise HTTPException(status_code=400, detail="Provide correct option indices")
    if not payload.study_card_refs:
        raise HTTPException(status_code=400, detail="Provide study card references")
    if any(index >= len(payload.options) or index < 0 for index in payload.correct_option_indices):
        raise HTTPException(status_code=400, detail="Correct indices out of range")
    if payload.type == "mcq" and len(payload.correct_option_indices) > 1:
        raise HTTPException(
            status_code=400,
            detail="MCQ questions must have exactly one correct option",
        )
    if payload.option_explanations is not None:
        if len(payload.option_explanations) != len(payload.options):
            raise HTTPException(
                status_code=400,
                detail="Option explanations must match options length",
            )

    card = QuestionCard(
        note_group_id=note_group_id,
        type=payload.type,
        prompt=payload.prompt,
        options_json=json.dumps(payload.options),
        correct_option_indices_json=json.dumps(payload.correct_option_indices),
        option_explanations_json=json.dumps(payload.option_explanations or []),
        study_card_refs_json=json.dumps(payload.study_card_refs),
        stale=False,
    )
    initialize_question_card(card, datetime.now(timezone.utc))
    db.add(card)
    db.flush()
    _record_subject_activity(
        db,
        subject_id=note_group.module.subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_CREATED,
        entity_type=SUBJECT_ACTIVITY_QUESTION_CARD,
        entity_id=card.id,
        entity_title=card.prompt[:120],
    )
    db.commit()
    db.refresh(card)
    return _serialize_question_card(card)


@app.post("/question-cards/{question_card_id}/review", response_model=QuestionCardOut)
def review_question(
    question_card_id: str,
    payload: QuestionCardReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = require_question_card_study(db, current_user, question_card_id)
    if payload.response_time_ms < 0:
        raise HTTPException(status_code=400, detail="Response time must be non-negative")
    correct_indices = json.loads(card.correct_option_indices_json or "[]")
    option_count = len(json.loads(card.options_json or "[]"))
    if any(index < 0 or index >= option_count for index in payload.answer_option_indices):
        raise HTTPException(status_code=400, detail="Answer indices out of range")
    if payload.correct:
        rating = Rating.Easy if payload.response_time_ms <= 30000 else Rating.Good
    else:
        rating = Rating.Again

    learning_state = _get_or_create_question_card_learning_state(db, card, current_user)
    previous_due_at = learning_state.due_at
    previous_difficulty = learning_state.difficulty
    previous_stability = learning_state.stability
    previous_state = learning_state.state
    previous_reps = learning_state.reps
    previous_lapses = learning_state.lapses

    now = datetime.now(timezone.utc)
    review_question_card(learning_state, rating, now, review_duration_ms=payload.response_time_ms)
    event = QuestionCardReviewEvent(
        question_card_id=card.id,
        user_id=current_user.id,
        note_group_id=card.note_group_id,
        module_id=card.note_group.module_id,
        correct=payload.correct,
        response_time_ms=payload.response_time_ms,
        rating=rating.name.lower(),
        previous_due_at=previous_due_at,
        next_due_at=learning_state.due_at,
        previous_difficulty=previous_difficulty,
        next_difficulty=learning_state.difficulty,
        previous_stability=previous_stability,
        next_stability=learning_state.stability,
        previous_state=previous_state,
        next_state=learning_state.state,
        previous_reps=previous_reps,
        next_reps=learning_state.reps,
        previous_lapses=previous_lapses,
        next_lapses=learning_state.lapses,
        answer_option_indices_json=json.dumps(payload.answer_option_indices),
        correct_option_indices_json=json.dumps(correct_indices),
        reviewed_at=now,
    )
    db.add(event)
    db.commit()
    db.refresh(learning_state)
    return _serialize_question_card(card, learning_state)


@app.put("/question-cards/{question_card_id}", response_model=QuestionCardOut)
def update_question_card(
    question_card_id: str,
    payload: QuestionCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = require_question_card_edit(db, current_user, question_card_id)
    if payload.type is not None:
        if payload.type not in {"mcq", "multi"}:
            raise HTTPException(status_code=400, detail="Invalid question type")
        card.type = payload.type
    if payload.prompt is not None:
        if not payload.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        card.prompt = payload.prompt
    if payload.options is not None:
        if len(payload.options) < 2:
            raise HTTPException(status_code=400, detail="Provide at least two options")
        card.options_json = json.dumps(payload.options)
    option_len = None
    if payload.correct_option_indices is not None:
        if payload.options is not None:
            option_len = len(payload.options)
        else:
            option_len = len(json.loads(card.options_json))
        if any(index >= option_len or index < 0 for index in payload.correct_option_indices):
            raise HTTPException(status_code=400, detail="Correct indices out of range")
        next_type = payload.type or card.type
        if next_type == "mcq" and len(payload.correct_option_indices) > 1:
            raise HTTPException(
                status_code=400,
                detail="MCQ questions must have exactly one correct option",
            )
        card.correct_option_indices_json = json.dumps(payload.correct_option_indices)
    elif payload.options is not None:
        existing_indices = json.loads(card.correct_option_indices_json)
        if any(index >= len(payload.options) or index < 0 for index in existing_indices):
            raise HTTPException(
                status_code=400,
                detail="Correct indices out of range for updated options",
            )
        option_len = len(payload.options)
    if payload.option_explanations is not None:
        if option_len is None:
            option_len = len(json.loads(card.options_json))
        if len(payload.option_explanations) != option_len:
            raise HTTPException(
                status_code=400,
                detail="Option explanations must match options length",
            )
        card.option_explanations_json = json.dumps(payload.option_explanations)
    elif payload.options is not None:
        card.option_explanations_json = json.dumps([])
    if payload.study_card_refs is not None:
        if not payload.study_card_refs:
            raise HTTPException(status_code=400, detail="Provide study card references")
        card.study_card_refs_json = json.dumps(payload.study_card_refs)
    db.commit()
    db.refresh(card)
    return _serialize_question_card(card)


@app.delete("/question-cards/{question_card_id}")
def delete_question_card(
    question_card_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = require_question_card_edit(db, current_user, question_card_id)
    subject_id = card.note_group.module.subject_id
    prompt = card.prompt
    _record_subject_activity(
        db,
        subject_id=subject_id,
        actor=current_user,
        event_type=SUBJECT_ACTIVITY_DELETED,
        entity_type=SUBJECT_ACTIVITY_QUESTION_CARD,
        entity_id=question_card_id,
        entity_title=prompt[:120],
    )
    db.delete(card)
    db.commit()
    return {"deleted": True}


@app.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    module = require_module_read(db, current_user, payload.module_id)

    if payload.note_group_id:
        note_group = require_note_group_read(db, current_user, payload.note_group_id)
        if not note_group or note_group.module_id != payload.module_id:
            raise HTTPException(status_code=404, detail="Note group not found")

    query_embedding = embed_texts([payload.message])[0]
    results = query_study_card_embeddings(
        db,
        query_embedding,
        payload.module_id,
        note_group_id=payload.note_group_id,
        limit=20,
    )
    if not results:
        return {
            "answer": "I couldn't find that in your study cards yet.",
            "study_card_refs": [],
        }

    filtered = [
        (result.study_card_id, result.content)
        for result in results
        if result.study_card_id and result.content
    ]
    if not filtered:
        return {
            "answer": "I couldn't find that in your study cards yet.",
            "study_card_refs": [],
        }

    filtered_ids = [card_id for card_id, _ in filtered]
    study_cards = (
        db.query(StudyCard)
        .filter(StudyCard.id.in_(filtered_ids))
        .all()
    )
    card_by_id = {card.id: card for card in study_cards}

    context_blocks = []
    question_context = []
    if payload.question_prompt:
        question_context.append(f"Prompt: {payload.question_prompt}")
    if payload.user_answer:
        question_context.append(f"Your answer: {payload.user_answer}")
    if payload.correct_answer:
        question_context.append(f"Correct answer: {payload.correct_answer}")
    if question_context:
        context_blocks.append("[Question Context] " + " | ".join(question_context))
    for card_id, doc in filtered:
        card = card_by_id.get(card_id)
        title = card.title if card and card.title else "Untitled"
        snippet = doc.strip()
        context_blocks.append(f"[{title} | {card_id}] {snippet}")

    history = []
    if payload.history:
        for item in payload.history[-10:]:
            role = getattr(item, "role", None)
            content = getattr(item, "content", None)
            if role in {"user", "assistant"} and content and content.strip():
                history.append({"role": role, "content": content.strip()})

    response = generate_chat_response(
        payload.message,
        context_blocks,
        history,
        filtered_ids,
    )
    used_refs = response.get("used_ref_ids", [])
    if not isinstance(used_refs, list):
        used_refs = []
    used_refs = [ref for ref in used_refs if ref in filtered_ids]
    return {"answer": response.get("answer", ""), "study_card_refs": used_refs}


_DIST_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)

if os.path.isdir(_DIST_DIR):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(_DIST_DIR, "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        candidate = os.path.join(_DIST_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_DIST_DIR, "index.html"))
