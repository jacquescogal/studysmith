import json
import os
from datetime import datetime, timezone, timedelta

from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fsrs import Rating
from sqlalchemy.orm import Session
from sqlalchemy import case, func, or_, text

from app.db import Base, engine, get_db
from sqlalchemy.exc import IntegrityError
from app.chroma import get_collection
from app.auto_queue import enqueue_auto_job, remove_auto_job, resume_auto_jobs, start_auto_worker
from app.jobs import (
    JOB_TYPE_NOTE_GROUP_GENERATION,
    JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION,
    JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
    run_note_group_generation,
    run_question_card_generation,
)
from app.models import (
    DEFAULT_MODULE_SETTINGS,
    Job,
    Module,
    NoteGroup,
    QuestionCard,
    StudyCard,
    Subject,
    TopicChip,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.fsrs_utils import initialize_question_card, review_question_card
from app.openai_client import (
    embed_texts,
    generate_chat_response,
    generate_formatted_sections,
    generate_module_intent_response,
    generate_note_group_title_suggestions,
    generate_study_cards_with_context,
    generate_subject_intent_response,
    suggest_topic_chips,
)
from app.text_formatter import build_formatted_sections, sections_to_markdown
from app.schemas import (
    ChatRequest,
    ChatResponse,
    IntentChatRequest,
    IntentChatResponse,
    JobOut,
    ModuleCreate,
    ModuleOut,
    ModuleUpdate,
    NoteGroupCreate,
    NoteGroupOut,
    NoteGroupFinalizeRequest,
    NoteGroupFinalizeResponse,
    NoteGroupAutoRequest,
    NoteGroupSourceCheckRequest,
    NoteGroupSourceCheckResponse,
    NoteGroupTitleSuggestionsRequest,
    NoteGroupTitleSuggestionsResponse,
    NoteGroupTitleUpdate,
    NoteGroupTopicChipSuggestRequest,
    NoteGroupTopicChipSuggestResponse,
    NoteGroupOrderUpdate,
    QuestionCardCreate,
    QuestionCardGenerate,
    QuestionCardList,
    QuestionCardOut,
    QuestionCardReview,
    QuestionCardUpdate,
    QuestionTimelineResponse,
    SubjectCreate,
    SubjectIntentChatPayload,
    SubjectOut,
    SubjectUpdate,
    StudyCardCreate,
    StudyCardOut,
    StudyCardList,
    StudyCardReview,
    StudyCardReviewResult,
    StudyCardUpdate,
    TopicChipAttach,
    TopicChipCreate,
    TopicChipOut,
)

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


Base.metadata.create_all(bind=engine)
_ensure_note_group_source_columns()
_ensure_module_settings_column()
_ensure_module_intent_columns()
_ensure_topic_chip_description_column()
_ensure_subject_intent_columns()

app = FastAPI(title="Study System API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _start_auto_worker() -> None:
    start_auto_worker()
    resume_auto_jobs()


def _serialize_question_card(card: QuestionCard) -> dict:
    try:
        option_explanations = json.loads(card.option_explanations_json or "[]")
        if not isinstance(option_explanations, list):
            option_explanations = []
    except json.JSONDecodeError:
        option_explanations = []
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
        "due_at": card.due_at,
        "last_review_at": card.last_review_at,
        "stability": card.stability,
        "difficulty": card.difficulty,
        "elapsed_days": card.elapsed_days,
        "scheduled_days": card.scheduled_days,
        "reps": card.reps,
        "lapses": card.lapses,
        "state": card.state,
        "step": card.step,
    }


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


def _build_question_timeline(cards: list[QuestionCard], now: datetime) -> dict:
    due_cutoff = now + timedelta(hours=6)
    timeline = {"due": 0, "week": 0, "month": 0, "six_months": 0, "long_term": 0}
    for card in cards:
        due_at = _normalize_due_at(card.due_at)
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
    chip_ids = ",".join([chip.id for chip in card.topic_chips])
    collection = get_collection()
    collection.upsert(
        ids=[card.id],
        embeddings=[embedding],
        documents=[card.content],
        metadatas=[
            {
                "note_group_id": card.note_group_id,
                "module_id": module_id,
                "chip_ids": chip_ids,
            }
        ],
    )


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
    note_group.suggested_titles_json = None
    note_group.generation_status = "queued"

    return study_card_ids


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/modules/intent-chat", response_model=IntentChatResponse)
def module_intent_chat(payload: IntentChatRequest):
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


@app.get("/subjects", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).order_by(Subject.created_at.desc()).all()


@app.post("/subjects", response_model=SubjectOut)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    subject = Subject(
        title=title,
        description=payload.description,
        goal=payload.goal.strip() if payload.goal else None,
        scope=payload.scope.strip() if payload.scope else None,
    )
    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
        return subject
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject title must be unique")


@app.post("/subjects/intent-chat", response_model=IntentChatResponse)
def subject_intent_chat(payload: SubjectIntentChatPayload):
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


@app.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: str, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@app.put("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: str, payload: SubjectUpdate, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
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
        return subject
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject title must be unique")


@app.delete("/subjects/{subject_id}")
def delete_subject(subject_id: str, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

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
        db.query(TopicChip).filter(TopicChip.module_id.in_(module_ids)).delete(
            synchronize_session=False
        )
        db.query(Module).filter(Module.id.in_(module_ids)).delete(synchronize_session=False)
    db.delete(subject)
    db.commit()

    if study_card_ids:
        collection = get_collection()
        collection.delete(ids=study_card_ids)

    return {"deleted": True}


@app.get("/subjects/{subject_id}/modules", response_model=list[ModuleOut])
def list_subject_modules(subject_id: str, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return (
        db.query(Module)
        .filter(Module.subject_id == subject_id)
        .order_by(Module.created_at.desc())
        .all()
    )


@app.post("/subjects/{subject_id}/modules", response_model=ModuleOut)
def create_subject_module(
    subject_id: str, payload: ModuleCreate, db: Session = Depends(get_db)
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
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
        db.commit()
        db.refresh(module)
        return module
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module title must be unique")


@app.get("/modules", response_model=list[ModuleOut])
def list_modules(db: Session = Depends(get_db)):
    return db.query(Module).order_by(Module.created_at.desc()).all()


@app.post("/modules", response_model=ModuleOut)
def create_module(payload: ModuleCreate, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=400, detail="Use /subjects/{subject_id}/modules instead"
    )


@app.put("/modules/{module_id}", response_model=ModuleOut)
def update_module(module_id: str, payload: ModuleUpdate, db: Session = Depends(get_db)):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
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
        return module
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module title must be unique")


@app.delete("/modules/{module_id}")
def delete_module(module_id: str, db: Session = Depends(get_db)):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    note_group_rows = db.query(NoteGroup.id).filter(NoteGroup.module_id == module_id).all()
    note_group_ids = [row[0] for row in note_group_rows]

    study_card_ids = _delete_note_groups(db, note_group_ids)
    db.query(TopicChip).filter(TopicChip.module_id == module_id).delete(
        synchronize_session=False
    )
    db.delete(module)
    db.commit()

    if study_card_ids:
        collection = get_collection()
        collection.delete(ids=study_card_ids)

    return {"deleted": True}


@app.post("/modules/{module_id}/note-groups", response_model=NoteGroupOut)
def create_note_group(module_id: str, payload: NoteGroupCreate, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=400, detail="Use /note-groups/finalize for note group creation"
    )


@app.get("/modules/{module_id}/note-groups", response_model=list[NoteGroupOut])
def list_note_groups(
    module_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

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
    return (
        query.order_by(
            sort_nulls_last,
            NoteGroup.sort_order.asc(),
            NoteGroup.created_at.asc(),
        )
        .all()
    )


@app.post("/note-groups/source-check", response_model=NoteGroupSourceCheckResponse)
def check_note_group_source(
    payload: NoteGroupSourceCheckRequest,
    db: Session = Depends(get_db),
):
    normalized = _normalize_source_text(payload.source or "")
    if not normalized:
        raise HTTPException(status_code=400, detail="Source cannot be empty")
    matches = (
        db.query(NoteGroup)
        .filter(NoteGroup.source_normalized == normalized)
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
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
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
):
    module = db.get(Module, payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    source_raw = payload.source.strip()
    source_normalized = _normalize_source_text(source_raw)
    if not source_normalized:
        raise HTTPException(status_code=400, detail="Source cannot be empty")

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
    default_question_count = module.settings.get("auto_question_count", 30)
    if payload.question_count is None:
        question_count = default_question_count
    else:
        try:
            question_count = int(payload.question_count)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Question count must be a number")
    if question_count < 1:
        raise HTTPException(status_code=400, detail="Question count must be at least 1")

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
    job = Job(
        type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
        note_group_id=note_group.id,
        payload_json=json.dumps({"question_count": question_count}),
    )
    db.add(job)
    note_group.title = job.id
    db.commit()
    db.refresh(job)

    enqueue_auto_job(job.id)
    return job


@app.post(
    "/note-groups/title-suggestions",
    response_model=NoteGroupTitleSuggestionsResponse,
)
def note_group_title_suggestions(
    payload: NoteGroupTitleSuggestionsRequest,
    db: Session = Depends(get_db),
):
    module = db.get(Module, payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not payload.raw_text.strip():
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    titles = generate_note_group_title_suggestions(module.title, payload.raw_text)
    return {"titles": titles}


@app.post(
    "/note-groups/topic-chips/suggest",
    response_model=NoteGroupTopicChipSuggestResponse,
)
def note_group_topic_chip_suggestions(
    payload: NoteGroupTopicChipSuggestRequest,
    db: Session = Depends(get_db),
):
    module = db.get(Module, payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not payload.raw_text.strip():
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    chips = (
        db.query(TopicChip)
        .filter(TopicChip.module_id == payload.module_id)
        .order_by(TopicChip.label.asc())
        .all()
    )
    module_chip_pool = [{"chipId": chip.id, "label": chip.label} for chip in chips]
    subject = module.subject
    suggestion = suggest_topic_chips(
        module_chip_pool,
        payload.raw_text,
        module_goal=module.goal,
        module_scope=module.scope,
        subject_title=subject.title,
        subject_goal=subject.goal,
        subject_scope=subject.scope,
    )
    attach_ids = [
        chip_id
        for chip_id in suggestion.get("attach_chip_ids", [])
        if any(chip.id == chip_id for chip in chips)
    ]
    new_chips = [
        label.strip()
        for label in suggestion.get("new_chips", [])
        if isinstance(label, str) and label.strip()
    ]
    return {"suggested_existing_ids": attach_ids, "new_chips": new_chips}


@app.post("/note-groups/finalize", response_model=NoteGroupFinalizeResponse)
def finalize_note_group(
    payload: NoteGroupFinalizeRequest,
    db: Session = Depends(get_db),
):
    module = db.get(Module, payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    subject = module.subject
    raw_text = payload.raw_text.strip()
    title = payload.title.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    source_raw = payload.source.strip()
    source_normalized = _normalize_source_text(source_raw)
    if not source_normalized:
        raise HTTPException(status_code=400, detail="Source cannot be empty")

    existing_chip_ids = payload.existing_chip_ids or []
    new_chip_labels = payload.new_chip_labels or []

    chips_in_module = (
        db.query(TopicChip)
        .filter(TopicChip.module_id == payload.module_id)
        .all()
    )
    chip_by_id = {chip.id: chip for chip in chips_in_module}
    chip_by_label = {chip.label.strip().lower(): chip for chip in chips_in_module}

    selected_chips: list[TopicChip] = []
    for chip_id in existing_chip_ids:
        chip = chip_by_id.get(chip_id)
        if chip and chip not in selected_chips:
            selected_chips.append(chip)

    for label in new_chip_labels:
        normalized = label.strip()
        if not normalized:
            continue
        key = normalized.lower()
        chip = chip_by_label.get(key)
        if not chip:
            chip = TopicChip(module_id=payload.module_id, label=normalized)
            db.add(chip)
            db.flush()
            chip_by_label[key] = chip
        if chip not in selected_chips:
            selected_chips.append(chip)

    chip_labels = [chip.label for chip in selected_chips]
    study_card_payloads = generate_study_cards_with_context(
        module_title=module.title,
        module_description=module.description,
        note_group_title=title,
        raw_text=raw_text,
        chip_labels=chip_labels,
        additional_instructions=payload.additional_generation_instructions,
        module_goal=module.goal,
        module_scope=module.scope,
        subject_title=subject.title,
        subject_goal=subject.goal,
        subject_scope=subject.scope,
    )
    if not study_card_payloads:
        raise HTTPException(status_code=422, detail="No study cards generated")

    note_group = NoteGroup(
        module_id=payload.module_id,
        title=title,
        source=source_raw,
        source_normalized=source_normalized,
        raw_text=raw_text,
        additional_generation_instructions=additional_instructions,
        generation_status="complete",
        sort_order=_next_note_group_sort_order(db, payload.module_id),
    )
    note_group.topic_chips = selected_chips
    db.add(note_group)

    study_cards: list[StudyCard] = []
    chip_label_map = {chip.label.strip().lower(): chip for chip in selected_chips}
    ids: list[str] = []
    collection = get_collection()

    try:
        db.flush()
        for payload_card in study_card_payloads:
            content = (payload_card.get("content") or "").strip()
            if not content:
                continue
            card_title = payload_card.get("title")
            card = StudyCard(
                note_group_id=note_group.id,
                title=card_title,
                content=content,
            )
            raw_chips = payload_card.get("topic_chips") or []
            if isinstance(raw_chips, list):
                for chip_label in raw_chips:
                    if not isinstance(chip_label, str):
                        continue
                    chip = chip_label_map.get(chip_label.strip().lower())
                    if chip and chip not in card.topic_chips:
                        card.topic_chips.append(chip)
            db.add(card)
            study_cards.append(card)

        if not study_cards:
            raise HTTPException(status_code=422, detail="Generated study cards were empty")

        db.flush()
        study_card_context = [
            {"id": card.id, "title": card.title, "content": card.content}
            for card in study_cards
        ]
        raw_sections = []
        try:
            raw_sections = generate_formatted_sections(raw_text, study_card_context)
        except Exception:
            raw_sections = []
        formatted_sections = build_formatted_sections(raw_sections, study_card_context)
        note_group.formatted_sections_json = json.dumps(formatted_sections)
        note_group.formatted_text = sections_to_markdown(formatted_sections)

        embeddings = embed_texts([card.content for card in study_cards])
        ids = [card.id for card in study_cards]
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=[card.content for card in study_cards],
            metadatas=[
                {
                    "note_group_id": note_group.id,
                    "module_id": module.id,
                    "chip_ids": ",".join([chip.id for chip in card.topic_chips]),
                }
                for card in study_cards
            ],
        )
        db.commit()
        db.refresh(note_group)
    except HTTPException:
        db.rollback()
        if ids:
            collection.delete(ids=ids)
        raise
    except Exception as exc:
        db.rollback()
        if ids:
            collection.delete(ids=ids)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"note_group": note_group, "study_cards": study_cards}


@app.put("/note-groups/{note_group_id}/title", response_model=NoteGroupOut)
def update_note_group_title(
    note_group_id: str,
    payload: NoteGroupTitleUpdate,
    db: Session = Depends(get_db),
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    note_group.title = title
    note_group.suggested_titles_json = None
    db.commit()
    db.refresh(note_group)
    return note_group


@app.get("/modules/{module_id}/topic-chips", response_model=list[TopicChipOut])
def list_topic_chips(module_id: str, db: Session = Depends(get_db)):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return (
        db.query(TopicChip)
        .filter(TopicChip.module_id == module_id)
        .order_by(TopicChip.label.asc())
        .all()
    )


@app.post("/modules/{module_id}/topic-chips", response_model=TopicChipOut)
def create_topic_chip(
    module_id: str, payload: TopicChipCreate, db: Session = Depends(get_db)
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label cannot be empty")
    _validate_chip_label(label)
    chip = TopicChip(module_id=module_id, label=label, description=payload.description)
    db.add(chip)
    db.commit()
    db.refresh(chip)
    return chip


@app.post("/note-groups/{note_group_id}/topic-chips", response_model=list[TopicChipOut])
def attach_topic_chips(
    note_group_id: str, payload: TopicChipAttach, db: Session = Depends(get_db)
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
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
def detach_topic_chip(note_group_id: str, chip_id: str, db: Session = Depends(get_db)):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    chip = db.get(TopicChip, chip_id)
    if not chip:
        raise HTTPException(status_code=404, detail="Topic chip not found")
    if chip in note_group.topic_chips:
        note_group.topic_chips.remove(chip)
        db.commit()
    return note_group.topic_chips


@app.get("/note-groups/{note_group_id}", response_model=NoteGroupOut)
def get_note_group(note_group_id: str, db: Session = Depends(get_db)):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    return note_group


@app.delete("/note-groups/{note_group_id}")
def delete_note_group(note_group_id: str, db: Session = Depends(get_db)):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")

    study_card_ids = _delete_note_groups(db, [note_group_id])
    db.commit()

    if study_card_ids:
        collection = get_collection()
        collection.delete(ids=study_card_ids)

    return {"deleted": True}


@app.post("/note-groups/{note_group_id}/generate", response_model=JobOut)
def generate_note_group(
    note_group_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")

    note_group.generation_status = "queued"
    job = Job(type=JOB_TYPE_NOTE_GROUP_GENERATION, note_group_id=note_group_id)
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_note_group_generation, job.id)

    return job


@app.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/jobs", response_model=list[JobOut])
def list_jobs(
    type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    module_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Job)
    if module_id:
        query = query.join(NoteGroup, Job.note_group_id == NoteGroup.id).filter(
            NoteGroup.module_id == module_id
        )
    if type:
        query = query.filter(Job.type == type)
    if status:
        statuses = [value.strip() for value in status.split(",") if value.strip()]
        if statuses:
            query = query.filter(Job.status.in_(statuses))
    return query.order_by(Job.created_at.desc()).all()


@app.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
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
def retry_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
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

    if study_card_ids:
        collection = get_collection()
        collection.delete(ids=study_card_ids)

    enqueue_auto_job(new_job.id)
    return new_job


@app.get("/note-groups/{note_group_id}/study-cards", response_model=StudyCardList)
def list_study_cards(note_group_id: str, db: Session = Depends(get_db)):
    cards = (
        db.query(StudyCard)
        .filter(StudyCard.note_group_id == note_group_id)
        .order_by(StudyCard.created_at.asc())
        .all()
    )
    return {"study_cards": cards}


@app.get("/study-cards/{study_card_id}", response_model=StudyCardOut)
def get_study_card(study_card_id: str, db: Session = Depends(get_db)):
    card = db.get(StudyCard, study_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Study card not found")
    return card


@app.post("/note-groups/{note_group_id}/study-cards", response_model=StudyCardOut)
def create_study_card(
    note_group_id: str, payload: StudyCardCreate, db: Session = Depends(get_db)
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
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
        _upsert_study_card_embedding(card, note_group.module_id)
        db.commit()
        db.refresh(card)
        return card
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.put("/study-cards/{study_card_id}", response_model=StudyCardOut)
def update_study_card(
    study_card_id: str, payload: StudyCardUpdate, db: Session = Depends(get_db)
):
    card = db.get(StudyCard, study_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Study card not found")
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
        db.commit()
        db.refresh(card)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    _mark_question_cards_stale(db, note_group.id, card.id)
    return card


@app.delete("/study-cards/{study_card_id}")
def delete_study_card(study_card_id: str, db: Session = Depends(get_db)):
    card = db.get(StudyCard, study_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Study card not found")
    note_group_id = card.note_group_id
    card_id = card.id
    db.delete(card)
    db.commit()
    collection = get_collection()
    collection.delete(ids=[card_id])
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
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")

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
    for card in cards:
        db.delete(card)
    db.commit()

    collection = get_collection()
    collection.delete(ids=ids_to_delete)

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
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")

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
def list_question_cards(note_group_id: str, db: Session = Depends(get_db)):
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id == note_group_id)
        .order_by(QuestionCard.created_at.asc())
        .all()
    )
    return {"question_cards": [_serialize_question_card(card) for card in cards]}


@app.get(
    "/note-groups/{note_group_id}/question-cards/timeline",
    response_model=QuestionTimelineResponse,
)
def get_note_group_question_timeline(
    note_group_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
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
    timeline = _build_question_timeline(cards, now)
    stale_count = sum(1 for card in cards if card.stale)
    return {
        "timeline": timeline,
        "question_count": len(cards),
        "stale_count": stale_count,
    }


@app.get("/note-groups/{note_group_id}/question-cards/review", response_model=QuestionCardList)
def list_review_question_cards(
    note_group_id: str,
    mode: str = Query(default="due"),
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
    now = datetime.now(timezone.utc)
    due_cutoff = now + timedelta(hours=6)
    query = db.query(QuestionCard).filter(QuestionCard.note_group_id == note_group_id)
    if mode == "due":
        query = query.filter(or_(QuestionCard.due_at <= due_cutoff, QuestionCard.due_at.is_(None)))
    elif mode == "queue":
        pass
    elif mode == "all":
        pass
    else:
        raise HTTPException(status_code=400, detail="Invalid review mode")

    query = query.order_by(QuestionCard.due_at.asc())
    if mode == "queue":
        query = query.limit(limit)
    cards = query.all()
    return {"question_cards": [_serialize_question_card(card) for card in cards]}


@app.get(
    "/modules/{module_id}/question-cards/timeline",
    response_model=QuestionTimelineResponse,
)
def get_module_question_timeline(
    module_id: str,
    chip_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
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
    timeline = _build_question_timeline(cards, now)
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
):
    module = db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    now = datetime.now(timezone.utc)
    due_cutoff = now + timedelta(hours=6)
    query = (
        db.query(QuestionCard)
        .join(NoteGroup, QuestionCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == module_id)
    )
    if mode == "due":
        query = query.filter(or_(QuestionCard.due_at <= due_cutoff, QuestionCard.due_at.is_(None)))
    elif mode == "queue":
        pass
    elif mode == "all":
        pass
    else:
        raise HTTPException(status_code=400, detail="Invalid review mode")

    query = query.order_by(QuestionCard.due_at.asc())
    if mode == "queue":
        query = query.limit(limit)
    cards = query.all()
    return {"question_cards": [_serialize_question_card(card) for card in cards]}


@app.post("/note-groups/{note_group_id}/question-cards", response_model=QuestionCardOut)
def create_question_card(
    note_group_id: str, payload: QuestionCardCreate, db: Session = Depends(get_db)
):
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise HTTPException(status_code=404, detail="Note group not found")
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
    db.commit()
    db.refresh(card)
    return _serialize_question_card(card)


@app.post("/question-cards/{question_card_id}/review", response_model=QuestionCardOut)
def review_question(
    question_card_id: str,
    payload: QuestionCardReview,
    db: Session = Depends(get_db),
):
    card = db.get(QuestionCard, question_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")
    if payload.response_time_ms < 0:
        raise HTTPException(status_code=400, detail="Response time must be non-negative")
    if payload.correct:
        rating = Rating.Easy if payload.response_time_ms <= 30000 else Rating.Good
    else:
        rating = Rating.Again
    now = datetime.now(timezone.utc)
    review_question_card(card, rating, now, review_duration_ms=payload.response_time_ms)
    db.commit()
    db.refresh(card)
    return _serialize_question_card(card)


@app.put("/question-cards/{question_card_id}", response_model=QuestionCardOut)
def update_question_card(
    question_card_id: str, payload: QuestionCardUpdate, db: Session = Depends(get_db)
):
    card = db.get(QuestionCard, question_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")
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
def delete_question_card(question_card_id: str, db: Session = Depends(get_db)):
    card = db.get(QuestionCard, question_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Question card not found")
    db.delete(card)
    db.commit()
    return {"deleted": True}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    module = db.get(Module, payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if payload.note_group_id:
        note_group = db.get(NoteGroup, payload.note_group_id)
        if not note_group or note_group.module_id != payload.module_id:
            raise HTTPException(status_code=404, detail="Note group not found")

    collection = get_collection()
    query_embedding = embed_texts([payload.message])[0]
    where = {"module_id": payload.module_id}
    if payload.note_group_id:
        where = {
            "$and": [
                {"module_id": payload.module_id},
                {"note_group_id": payload.note_group_id},
            ]
        }

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=20,
        where=where,
    )
    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    if not ids or not documents:
        return {
            "answer": "I couldn't find that in your study cards yet.",
            "study_card_refs": [],
        }

    filtered = [(card_id, doc) for card_id, doc in zip(ids, documents) if card_id and doc]
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
