import json
from typing import Optional

from sqlalchemy.orm import Session

from app.chroma import get_collection
from app.db import SessionLocal
from app.fsrs_utils import initialize_question_card

from app.models import (
    Job,
    NoteGroup,
    QuestionCard,
    StudyCard,
    TopicChip,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.openai_client import (
    embed_texts,
    generate_formatted_sections,
    generate_note_group_title_suggestions,
    generate_question_cards,
    generate_study_cards,
    generate_study_cards_with_context,
    suggest_topic_chips,
)
from app.text_formatter import build_formatted_sections, sections_to_markdown


JOB_TYPE_NOTE_GROUP_GENERATION = "NOTE_GROUP_GENERATION"
JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION = "NOTE_GROUP_QUESTION_GENERATION"
JOB_TYPE_NOTE_GROUP_AUTO_GENERATION = "NOTE_GROUP_AUTO_GENERATION"


class AutoJobCancelled(Exception):
    pass


def _raise_if_cancelled(db: Session, job: Job) -> None:
    db.refresh(job)
    if job.status == "cancelled":
        raise AutoJobCancelled()


def _cleanup_note_group(db: Session, note_group: NoteGroup) -> list[str]:
    study_card_rows = (
        db.query(StudyCard.id)
        .filter(StudyCard.note_group_id == note_group.id)
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
            note_group_topic_chips.c.note_group_id == note_group.id
        )
    )
    db.query(QuestionCard).filter(
        QuestionCard.note_group_id == note_group.id
    ).delete(synchronize_session=False)
    db.query(StudyCard).filter(StudyCard.note_group_id == note_group.id).delete(
        synchronize_session=False
    )
    note_group.formatted_text = None
    note_group.formatted_sections_json = None
    note_group.suggested_titles_json = None
    note_group.generation_status = "cancelled"
    return study_card_ids


def _cleanup_note_group_by_id(db: Session, note_group_id: str) -> list[str]:
    study_card_rows = (
        db.query(StudyCard.id)
        .filter(StudyCard.note_group_id == note_group_id)
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
            note_group_topic_chips.c.note_group_id == note_group_id
        )
    )
    db.query(QuestionCard).filter(
        QuestionCard.note_group_id == note_group_id
    ).delete(synchronize_session=False)
    db.query(StudyCard).filter(StudyCard.note_group_id == note_group_id).delete(
        synchronize_session=False
    )
    return study_card_ids


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
    option_explanations = (
        payload.get("option_explanations")
        or payload.get("option_explanation")
        or payload.get("option_reasons")
        or payload.get("explanations")
        or payload.get("reasons")
        or []
    )
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
        normalized_explanations = []
        derived_indices = []
        for option in options:
            text = option.get("text") or option.get("option") or option.get("label")
            if text:
                normalized_options.append(text)
                normalized_index = len(normalized_options) - 1
                explanation = option.get("explanation") or option.get("reason") or ""
                normalized_explanations.append(explanation)
                if option.get("correct") is True:
                    derived_indices.append(normalized_index)
        options = normalized_options
        if normalized_explanations:
            option_explanations = normalized_explanations
        if not correct_indices and derived_indices:
            correct_indices = derived_indices

    if isinstance(options, str):
        options = [options]
    if not isinstance(options, list) or len(options) < 2:
        return None

    if isinstance(option_explanations, str):
        option_explanations = [option_explanations]
    if not isinstance(option_explanations, list):
        option_explanations = []
    option_explanations = [str(item).strip() for item in option_explanations]
    if option_explanations:
        if len(option_explanations) < len(options):
            option_explanations += [""] * (len(options) - len(option_explanations))
        elif len(option_explanations) > len(options):
            option_explanations = option_explanations[: len(options)]

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
    if card_type == "mcq" and len(correct_indices) > 1:
        card_type = "multi"

    return {
        "type": card_type,
        "prompt": prompt,
        "options": options,
        "correct_option_indices": correct_indices,
        "option_explanations": option_explanations,
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
        additional_instructions = note_group.additional_generation_instructions
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
            additional_instructions=additional_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=module.subject.title,
            subject_goal=module.subject.goal,
            subject_scope=module.subject.scope,
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

        study_card_context = [
            {"id": card.id, "title": card.title, "content": card.content}
            for card in study_cards
        ]
        raw_sections = []
        try:
            raw_sections = generate_formatted_sections(note_group.raw_text, study_card_context)
        except Exception:
            raw_sections = []
        formatted_sections = build_formatted_sections(raw_sections, study_card_context)
        note_group.formatted_sections_json = json.dumps(formatted_sections)
        note_group.formatted_text = sections_to_markdown(formatted_sections)

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

        module = note_group.module
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
            additional_instructions=note_group.additional_generation_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=module.subject.title,
            subject_goal=module.subject.goal,
            subject_scope=module.subject.scope,
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
                option_explanations_json=json.dumps(
                    normalized.get("option_explanations") or []
                ),
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


def run_auto_note_group_generation(job_id: str, question_count: int) -> None:
    db: Session = SessionLocal()
    note_group: Optional[NoteGroup] = None
    job: Optional[Job] = None
    study_card_ids: list[str] = []
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
        additional_instructions = note_group.additional_generation_instructions
        raw_text = (note_group.raw_text or "").strip()
        if not raw_text:
            raise ValueError("Raw text cannot be empty")

        suggestions: list[str] = []
        try:
            suggestions = generate_note_group_title_suggestions(module.title, raw_text)
        except Exception:
            suggestions = []
        existing_titles = {
            (group.title or "").strip().lower()
            for group in db.query(NoteGroup.title)
            .filter(NoteGroup.module_id == module.id)
            .all()
            if group[0]
        }
        base_title = ""
        if suggestions and isinstance(suggestions, list):
            for candidate in suggestions:
                candidate_title = str(candidate).strip()
                if candidate_title:
                    base_title = candidate_title
                    break
        if not base_title:
            words = raw_text.split()
            base_title = " ".join(words[:6]).strip() or "Study notes"
        title = base_title
        if title.lower() in existing_titles:
            suffix = 2
            while f"{base_title} ({suffix})".lower() in existing_titles:
                suffix += 1
            title = f"{base_title} ({suffix})"
        note_group.title = title
        if suggestions:
            note_group.suggested_titles_json = json.dumps(suggestions[:3])
        _raise_if_cancelled(db, job)

        chips_in_module = (
            db.query(TopicChip).filter(TopicChip.module_id == module.id).all()
        )
        attach_ids: list[str] = []
        new_chips: list[str] = []
        try:
            module_chip_pool = [{"chipId": chip.id, "label": chip.label} for chip in chips_in_module]
            suggestion = suggest_topic_chips(module_chip_pool, raw_text, module_goal=module.goal, module_scope=module.scope, subject_title=module.subject.title, subject_goal=module.subject.goal, subject_scope=module.subject.scope)
            attach_ids = [
                chip_id
                for chip_id in suggestion.get("attach_chip_ids", [])
                if any(chip.id == chip_id for chip in chips_in_module)
            ]
            new_chips = [
                label.strip()
                for label in suggestion.get("new_chips", [])
                if isinstance(label, str) and label.strip()
            ]
        except Exception:
            attach_ids = []
            new_chips = []

        chip_by_id = {chip.id: chip for chip in chips_in_module}
        chip_by_label = {chip.label.strip().lower(): chip for chip in chips_in_module}
        selected_chips: list[TopicChip] = []
        for chip_id in attach_ids:
            chip = chip_by_id.get(chip_id)
            if chip and chip not in selected_chips:
                selected_chips.append(chip)
        for label in new_chips:
            normalized = label.strip()
            if not normalized:
                continue
            key = normalized.lower()
            chip = chip_by_label.get(key)
            if not chip:
                chip = TopicChip(module_id=module.id, label=normalized)
                db.add(chip)
                db.flush()
                chip_by_label[key] = chip
            if chip not in selected_chips:
                selected_chips.append(chip)
        note_group.topic_chips = selected_chips
        db.commit()
        _raise_if_cancelled(db, job)

        chip_labels = [chip.label for chip in selected_chips]
        _raise_if_cancelled(db, job)
        study_card_payloads = generate_study_cards_with_context(
            module_title=module.title,
            module_description=module.description,
            note_group_title=note_group.title or "",
            raw_text=raw_text,
            chip_labels=chip_labels,
            additional_instructions=additional_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=module.subject.title,
            subject_goal=module.subject.goal,
            subject_scope=module.subject.scope,
        )
        _raise_if_cancelled(db, job)
        if not study_card_payloads:
            raise ValueError("No study cards generated")

        study_cards: list[StudyCard] = []
        chip_label_map = {chip.label.strip().lower(): chip for chip in selected_chips}
        for payload in study_card_payloads:
            content = (payload.get("content") or "").strip()
            if not content:
                continue
            card_title = payload.get("title")
            card = StudyCard(
                note_group_id=note_group.id,
                title=card_title,
                content=content,
            )
            raw_chips = payload.get("topic_chips") or []
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
            raise ValueError("Generated study cards were empty")

        db.flush()
        study_card_context = [
            {"id": card.id, "title": card.title, "content": card.content}
            for card in study_cards
        ]
        study_card_ids = [card.id for card in study_cards]
        study_card_contents = [card.content for card in study_cards]
        chroma_metadatas = [
            {
                "note_group_id": note_group.id,
                "module_id": module.id,
                "chip_ids": ",".join([chip.id for chip in card.topic_chips]),
            }
            for card in study_cards
        ]
        db.commit()
        _raise_if_cancelled(db, job)

        raw_sections = []
        try:
            raw_sections = generate_formatted_sections(raw_text, study_card_context)
        except Exception:
            raw_sections = []
        formatted_sections = build_formatted_sections(raw_sections, study_card_context)
        note_group = db.get(NoteGroup, note_group.id)
        if not note_group:
            raise ValueError("Note group not found")
        note_group.formatted_sections_json = json.dumps(formatted_sections)
        note_group.formatted_text = sections_to_markdown(formatted_sections)
        db.commit()

        embeddings = embed_texts(study_card_contents)
        collection = get_collection()
        collection.upsert(
            ids=study_card_ids,
            embeddings=embeddings,
            documents=study_card_contents,
            metadatas=chroma_metadatas,
        )
        _raise_if_cancelled(db, job)

        question_payloads = generate_question_cards(
            study_cards=[
                {
                    "studyCardId": card["id"],
                    "title": card["title"],
                    "content": card["content"],
                }
                for card in study_card_context
            ],
            existing_questions=[],
            count=question_count,
            difficulty="mixed",
            additional_instructions=additional_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=module.subject.title,
            subject_goal=module.subject.goal,
            subject_scope=module.subject.scope,
        )
        created = 0
        if question_payloads:
            for payload in question_payloads:
                if created >= question_count:
                    break
                normalized = _normalize_question_payload(payload)
                if not normalized:
                    continue
                question_card = QuestionCard(
                    note_group_id=note_group.id,
                    type=normalized["type"],
                    prompt=normalized["prompt"],
                    options_json=json.dumps(normalized["options"]),
                    correct_option_indices_json=json.dumps(
                        normalized["correct_option_indices"]
                    ),
                    option_explanations_json=json.dumps(
                        normalized.get("option_explanations") or []
                    ),
                    study_card_refs_json=json.dumps(normalized["study_card_refs"]),
                    stale=False,
                )
                initialize_question_card(question_card)
                db.add(question_card)
                created += 1

        _raise_if_cancelled(db, job)
        note_group = db.get(NoteGroup, note_group.id)
        if note_group:
            note_group.generation_status = "complete"
        job = db.get(Job, job_id)
        if job:
            job.status = "completed"
        db.commit()
    except AutoJobCancelled:
        db.rollback()
        job = db.get(Job, job_id)
        note_group = job.note_group if job else None
        cancelled_ids: list[str] = []
        if job:
            job.status = "cancelled"
        if note_group:
            cancelled_ids = _cleanup_note_group(db, note_group)
        elif job and job.note_group_id:
            cancelled_ids = _cleanup_note_group_by_id(db, job.note_group_id)
        for card_id in cancelled_ids:
            if card_id not in study_card_ids:
                study_card_ids.append(card_id)
        db.commit()
        if study_card_ids:
            collection = get_collection()
            collection.delete(ids=study_card_ids)
    except Exception as exc:
        if job:
            job.status = "failed"
            job.error = str(exc)
        if note_group:
            note_group.generation_status = "failed"
        db.commit()
    finally:
        db.close()
