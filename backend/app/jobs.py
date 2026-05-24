import json
from typing import Optional

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.fsrs_utils import initialize_question_card
from app.mind_map import regenerate_note_group_mind_map

from app.models import (
    Job,
    MindMapConcept,
    NoteGroup,
    QuestionCard,
    StudyCard,
    StudyCardSourceRange,
    TopicChip,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.openai_client import (
    embed_texts,
    generate_cleaned_text_markdown,
    generate_formatted_sections,
    generate_mind_map_candidate_graph,
    generate_note_group_title_suggestions,
    generate_question_cards,
    generate_study_cards_with_context,
    suggest_topic_chips,
)
from app.source_ranges import find_evidence_ranges
from app.text_formatter import build_formatted_sections, sections_to_markdown
from app.vector_store import delete_study_card_embeddings, upsert_study_card_embeddings


JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION = "NOTE_GROUP_QUESTION_GENERATION"
JOB_TYPE_NOTE_GROUP_AUTO_GENERATION = "NOTE_GROUP_AUTO_GENERATION"
JOB_TYPE_MIND_MAP_GENERATION = "MIND_MAP_GENERATION"


class AutoJobCancelled(Exception):
    pass


def _store_study_card_source_ranges(
    db: Session,
    study_card: StudyCard,
    cleaned_text_markdown: Optional[str],
    evidence_snippets,
) -> None:
    if not cleaned_text_markdown or not isinstance(evidence_snippets, list):
        return
    db.query(StudyCardSourceRange).filter(
        StudyCardSourceRange.study_card_id == study_card.id
    ).delete(synchronize_session=False)
    for start_index, end_index in find_evidence_ranges(
        cleaned_text_markdown, evidence_snippets
    ):
        db.add(
            StudyCardSourceRange(
                note_group_id=study_card.note_group_id,
                study_card_id=study_card.id,
                start_index=start_index,
                end_index=end_index,
            )
        )


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
    note_group.formatted_text = None
    note_group.formatted_sections_json = None
    note_group.cleaned_text_markdown = None
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
        subject = module.subject
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
            difficulty=difficulty,
            additional_instructions=note_group.additional_generation_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=subject.title,
            subject_goal=subject.goal,
            subject_scope=subject.scope,
        )
        question_payloads = question_payloads[:100]
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


def run_mind_map_generation(job_id: str) -> None:
    db: Session = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return

        job.status = "running"
        job.error = None
        note_group = job.note_group
        if note_group:
            note_group.mind_map_status = "generating"
        db.commit()

        if not note_group:
            job = db.get(Job, job_id)
            if job:
                job.status = "failed"
                job.error = "Note group not found"
                db.commit()
            return

        module = note_group.module
        if not module:
            raise ValueError("Module not found")

        study_cards = (
            db.query(StudyCard)
            .filter(StudyCard.note_group_id == note_group.id)
            .order_by(StudyCard.created_at.asc(), StudyCard.id.asc())
            .all()
        )
        if not study_cards:
            raise ValueError("No Study Cards available for Concept Mind Map generation")

        study_card_payloads = [
            {
                "study_card_id": card.id,
                "title": card.title,
                "content": card.content,
                "topic_labels": sorted(chip.label for chip in card.topic_chips),
            }
            for card in study_cards
        ]
        existing_concepts = (
            db.query(MindMapConcept)
            .filter(MindMapConcept.module_id == module.id)
            .order_by(MindMapConcept.title.asc(), MindMapConcept.id.asc())
            .all()
        )
        existing_concept_payloads = [
            {
                "concept_id": concept.id,
                "title": concept.title,
                "summary": concept.summary,
                "concept_type": concept.concept_type,
                "importance": concept.importance,
            }
            for concept in existing_concepts
        ]

        candidate_payload = generate_mind_map_candidate_graph(
            module_title=module.title,
            note_group_title=note_group.title or "",
            study_cards=study_card_payloads,
            existing_concepts=existing_concept_payloads,
        )
        if "links" not in candidate_payload and "study_card_concept_links" in candidate_payload:
            candidate_payload = {
                **candidate_payload,
                "links": candidate_payload["study_card_concept_links"],
            }

        regenerate_note_group_mind_map(db, note_group.id, candidate_payload)
        job = db.get(Job, job_id)
        if job:
            job.status = "completed"
            job.error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(Job, job_id)
        if job:
            job.status = "failed"
            job.error = str(exc)
            note_group = job.note_group
            if note_group:
                note_group.mind_map_status = "failed"
            db.commit()
    finally:
        db.close()


def run_auto_note_group_generation(job_id: str) -> None:
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
        subject = module.subject
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
            suggestion = suggest_topic_chips(
                module_chip_pool,
                raw_text,
                module_goal=module.goal,
                module_scope=module.scope,
                subject_title=subject.title,
                subject_goal=subject.goal,
                subject_scope=subject.scope,
            )
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

        cleaned_text_markdown = generate_cleaned_text_markdown(raw_text)
        note_group.cleaned_text_markdown = cleaned_text_markdown
        db.commit()
        _raise_if_cancelled(db, job)

        chip_labels = [chip.label for chip in selected_chips]
        _raise_if_cancelled(db, job)
        study_card_payloads = generate_study_cards_with_context(
            module_title=module.title,
            module_description=module.description,
            note_group_title=note_group.title or "",
            raw_text=cleaned_text_markdown,
            chip_labels=chip_labels,
            additional_instructions=additional_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=subject.title,
            subject_goal=subject.goal,
            subject_scope=subject.scope,
        )
        _raise_if_cancelled(db, job)
        if not study_card_payloads:
            raise ValueError("No study cards generated")

        study_cards: list[StudyCard] = []
        card_payload_pairs = []
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
            card_payload_pairs.append((card, payload))

        if not study_cards:
            raise ValueError("Generated study cards were empty")

        db.flush()
        for card, payload in card_payload_pairs:
            _store_study_card_source_ranges(
                db,
                card,
                cleaned_text_markdown,
                payload.get("evidence_snippets"),
            )
        study_card_context = [
            {"id": card.id, "title": card.title, "content": card.content}
            for card in study_cards
        ]
        study_card_ids = [card.id for card in study_cards]
        study_card_contents = [card.content for card in study_cards]
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
        upsert_study_card_embeddings(
            db,
            [
                (card, module.id, embedding)
                for card, embedding in zip(study_cards, embeddings)
            ],
        )
        db.commit()
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
            difficulty="mixed",
            additional_instructions=additional_instructions,
            module_goal=module.goal,
            module_scope=module.scope,
            subject_title=subject.title,
            subject_goal=subject.goal,
            subject_scope=subject.scope,
        )
        question_payloads = question_payloads[:100]
        created = 0
        if question_payloads:
            for payload in question_payloads:
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
        if study_card_ids:
            delete_study_card_embeddings(db, study_card_ids)
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
