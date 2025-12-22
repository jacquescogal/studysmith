import json
from typing import Optional

from sqlalchemy.orm import Session

from app.chroma import get_collection
from app.db import SessionLocal
from app.fsrs_utils import initialize_question_card

from app.models import Job, NoteGroup, QuestionCard, StudyCard
from app.openai_client import (
    embed_texts,
    generate_note_group_title_suggestions,
    generate_question_cards,
    generate_study_cards,
)


JOB_TYPE_NOTE_GROUP_GENERATION = "NOTE_GROUP_GENERATION"
JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION = "NOTE_GROUP_QUESTION_GENERATION"


def _normalize_question_payload(payload: dict) -> Optional[dict]:
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return None

    card_type = payload.get("type") or "mcq"
    card_type = card_type.lower().replace("-", "_")
    if card_type in {"multi_answer", "multi"}:
        card_type = "multi"
    else:
        card_type = "mcq"

    refs = (
        payload.get("study_card_refs")
        or payload.get("studyCardRefs")
        or payload.get("study_card_ids")
        or payload.get("studyCardIds")
        or payload.get("refs")
        or []
    )
    if isinstance(refs, str):
        refs = [refs]
    if not isinstance(refs, list) or not refs:
        return None

    options = payload.get("options") or payload.get("choices") or []
    correct_indices = (
        payload.get("correct_option_indices")
        or payload.get("correct_indices")
        or payload.get("correct_option_index")
    )
    if isinstance(correct_indices, int):
        correct_indices = [correct_indices]
    if correct_indices is None:
        correct_indices = []

    if options and isinstance(options, list) and options and isinstance(options[0], dict):
        normalized_options = []
        derived_indices = []
        for idx, option in enumerate(options):
            text = option.get("text") or option.get("option") or option.get("label")
            if text:
                normalized_options.append(text)
                if option.get("correct") is True:
                    derived_indices.append(idx)
        options = normalized_options
        if not correct_indices and derived_indices:
            correct_indices = derived_indices

    if isinstance(options, str):
        options = [options]
    if not isinstance(options, list) or len(options) < 2:
        return None

    if not correct_indices:
        answers = payload.get("correct_answers") or payload.get("answer")
        if answers:
            if isinstance(answers, str):
                answers = [answers]
            indices = []
            for answer in answers:
                for idx, option in enumerate(options):
                    if option.strip().lower() == str(answer).strip().lower():
                        indices.append(idx)
            correct_indices = indices

    correct_indices = [
        idx for idx in correct_indices if isinstance(idx, int) and 0 <= idx < len(options)
    ]
    if not correct_indices:
        return None

    return {
        "type": card_type,
        "prompt": prompt,
        "options": options,
        "correct_option_indices": correct_indices,
        "study_card_refs": refs,
    }


def run_note_group_generation(job_id: str) -> None:
    db: Session = SessionLocal()
    note_group: Optional[NoteGroup] = None
    job: Optional[Job] = None
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        job.status = "running"
        note_group = job.note_group
        if not note_group:
            job.status = "failed"
            job.error = "Note group not found"
            db.commit()
            return
        note_group.generation_status = "generating"
        db.commit()

        module = note_group.module
        if not note_group.title:
            try:
                suggestions = generate_note_group_title_suggestions(
                    module.title, note_group.raw_text
                )
            except Exception:
                words = note_group.raw_text.strip().split()
                base = " ".join(words[:6]) or "Study notes"
                suggestions = [
                    base,
                    f"{base} overview",
                    f"Key concepts: {base}",
                ]
            note_group.suggested_titles_json = json.dumps(suggestions[:3])
            db.commit()
        study_card_payloads = generate_study_cards(
            module_title=module.title,
            module_description=module.description,
            raw_text=note_group.raw_text,
        )
        if not study_card_payloads:
            raise ValueError("No study cards generated")

        study_cards: list[StudyCard] = []
        for payload in study_card_payloads:
            content = (payload.get("content") or "").strip()
            if not content:
                continue
            title = payload.get("title")
            study_card = StudyCard(
                note_group_id=note_group.id,
                title=title,
                content=content,
            )
            db.add(study_card)
            study_cards.append(study_card)
        db.commit()

        if not study_cards:
            raise ValueError("Generated study cards were empty")

        embeddings = embed_texts([card.content for card in study_cards])
        collection = get_collection()
        collection.upsert(
            ids=[card.id for card in study_cards],
            embeddings=embeddings,
            documents=[card.content for card in study_cards],
            metadatas=[
                {"note_group_id": note_group.id, "module_id": module.id}
                for _ in study_cards
            ],
        )

        note_group.generation_status = "complete"
        job.status = "completed"
        db.commit()
    except Exception as exc:
        if job:
            job.status = "failed"
            job.error = str(exc)
        if note_group:
            note_group.generation_status = "failed"
        db.commit()
    finally:
        db.close()


def run_question_card_generation(job_id: str, count: int, difficulty: str) -> None:
    db: Session = SessionLocal()
    note_group: Optional[NoteGroup] = None
    job: Optional[Job] = None
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        job.status = "running"
        note_group = job.note_group
        if not note_group:
            job.status = "failed"
            job.error = "Note group not found"
            db.commit()
            return

        study_cards = (
            db.query(StudyCard)
            .filter(StudyCard.note_group_id == note_group.id)
            .order_by(StudyCard.created_at.asc())
            .all()
        )
        if not study_cards:
            raise ValueError("No study cards available for question generation")

        study_card_payloads = [
            {
                "studyCardId": card.id,
                "title": card.title,
                "content": card.content,
            }
            for card in study_cards
        ]

        existing_questions = (
            db.query(QuestionCard)
            .filter(QuestionCard.note_group_id == note_group.id)
            .order_by(QuestionCard.created_at.asc())
            .all()
        )
        existing_prompts = [card.prompt for card in existing_questions if card.prompt]

        question_payloads = generate_question_cards(
            study_cards=study_card_payloads,
            existing_questions=existing_prompts,
            count=count,
            difficulty=difficulty,
        )
        if not question_payloads:
            job.status = "completed"
            db.commit()
            return

        created = 0
        existing_prompt_set = {prompt.strip().lower() for prompt in existing_prompts if prompt}
        for payload in question_payloads:
            normalized = _normalize_question_payload(payload)
            if not normalized:
                continue
            prompt_key = normalized["prompt"].strip().lower()
            if prompt_key in existing_prompt_set:
                continue
            question_card = QuestionCard(
                note_group_id=note_group.id,
                type=normalized["type"],
                prompt=normalized["prompt"],
                options_json=json.dumps(normalized["options"]),
                correct_option_indices_json=json.dumps(normalized["correct_option_indices"]),
                study_card_refs_json=json.dumps(normalized["study_card_refs"]),
                stale=False,
            )
            initialize_question_card(question_card)
            db.add(question_card)
            existing_prompt_set.add(prompt_key)
            created += 1
        job.status = "completed"
        db.commit()
    except Exception as exc:
        if job:
            job.status = "failed"
            job.error = str(exc)
        db.commit()
    finally:
        db.close()
