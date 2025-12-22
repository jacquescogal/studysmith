import json
from datetime import datetime, timezone

from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fsrs import Rating
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db import Base, engine, get_db
from sqlalchemy.exc import IntegrityError
from app.chroma import get_collection
from app.jobs import (
    JOB_TYPE_NOTE_GROUP_GENERATION,
    JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION,
    run_note_group_generation,
    run_question_card_generation,
)
from app.models import (
    Job,
    Module,
    NoteGroup,
    QuestionCard,
    StudyCard,
    Subject,
    TopicChip,
    note_group_topic_chips,
)
from app.fsrs_utils import initialize_question_card, review_question_card
from app.openai_client import (
    embed_texts,
    generate_chat_response,
    generate_note_group_title_suggestions,
    generate_study_cards_with_context,
    suggest_topic_chips,
)
from app.schemas import (
    ChatRequest,
    ChatResponse,
    JobOut,
    ModuleCreate,
    ModuleOut,
    NoteGroupCreate,
    NoteGroupOut,
    NoteGroupFinalizeRequest,
    NoteGroupFinalizeResponse,
    NoteGroupTitleSuggestionsRequest,
    NoteGroupTitleSuggestionsResponse,
    NoteGroupTitleUpdate,
    NoteGroupTopicChipSuggestRequest,
    NoteGroupTopicChipSuggestResponse,
    QuestionCardCreate,
    QuestionCardGenerate,
    QuestionCardList,
    QuestionCardOut,
    QuestionCardReview,
    QuestionCardUpdate,
    SubjectCreate,
    SubjectOut,
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

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Study System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _serialize_question_card(card: QuestionCard) -> dict:
    return {
        "id": card.id,
        "note_group_id": card.note_group_id,
        "type": card.type,
        "prompt": card.prompt,
        "options": json.loads(card.options_json),
        "correct_option_indices": json.loads(card.correct_option_indices_json),
        "study_card_refs": json.loads(card.study_card_refs_json),
        "stale": card.stale,
        "due_at": card.due_at,
        "last_review_at": card.last_review_at,
    }


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


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/subjects", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).order_by(Subject.created_at.desc()).all()


@app.post("/subjects", response_model=SubjectOut)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    subject = Subject(title=title, description=payload.description)
    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
        return subject
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject title must be unique")


@app.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: str, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


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
    module = Module(subject_id=subject_id, title=title, description=payload.description)
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

    return query.order_by(NoteGroup.created_at.desc()).all()


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
    suggestion = suggest_topic_chips(module_chip_pool, payload.raw_text)
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
    raw_text = payload.raw_text.strip()
    title = payload.title.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Raw text cannot be empty")
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

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
    )
    if not study_card_payloads:
        raise HTTPException(status_code=422, detail="No study cards generated")

    note_group = NoteGroup(
        module_id=payload.module_id,
        title=title,
        raw_text=raw_text,
        generation_status="complete",
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
    chip = TopicChip(module_id=module_id, label=label)
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


@app.get("/note-groups/{note_group_id}/study-cards", response_model=StudyCardList)
def list_study_cards(note_group_id: str, db: Session = Depends(get_db)):
    cards = (
        db.query(StudyCard)
        .filter(StudyCard.note_group_id == note_group_id)
        .order_by(StudyCard.created_at.asc())
        .all()
    )
    return {"study_cards": cards}


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
    query = db.query(QuestionCard).filter(QuestionCard.note_group_id == note_group_id)
    if mode == "due":
        query = query.filter(or_(QuestionCard.due_at <= now, QuestionCard.due_at.is_(None)))
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

    card = QuestionCard(
        note_group_id=note_group_id,
        type=payload.type,
        prompt=payload.prompt,
        options_json=json.dumps(payload.options),
        correct_option_indices_json=json.dumps(payload.correct_option_indices),
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
        rating = Rating.Easy if payload.response_time_ms <= 10000 else Rating.Good
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
    if payload.correct_option_indices is not None:
        if payload.options is not None:
            option_len = len(payload.options)
        else:
            option_len = len(json.loads(card.options_json))
        if any(index >= option_len or index < 0 for index in payload.correct_option_indices):
            raise HTTPException(status_code=400, detail="Correct indices out of range")
        card.correct_option_indices_json = json.dumps(payload.correct_option_indices)
    elif payload.options is not None:
        existing_indices = json.loads(card.correct_option_indices_json)
        if any(index >= len(payload.options) or index < 0 for index in existing_indices):
            raise HTTPException(
                status_code=400,
                detail="Correct indices out of range for updated options",
            )
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
        n_results=5,
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
    for card_id, doc in filtered:
        card = card_by_id.get(card_id)
        title = card.title if card and card.title else "Untitled"
        snippet = doc.strip()
        context_blocks.append(f"[{title} | {card_id}] {snippet}")

    answer = generate_chat_response(payload.message, context_blocks)
    return {"answer": answer, "study_card_refs": filtered_ids}
