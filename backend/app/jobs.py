import json
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session, selectinload

from app.db import SessionLocal
from app.fsrs_utils import initialize_question_card
from app.mind_map import regenerate_note_group_mind_map
from app.mind_map import (
    build_topic_knowledge_node_generation_context,
    regenerate_topic_knowledge_nodes,
    run_dependency_aware_topic_tasks,
)

from app.generation_workflow import (
    JOB_DELETE_REQUESTED_ERROR,
    JOB_STAGE_SEQUENCE,
    append_job_log,
    cancel_job_workflow,
    delete_job_and_draft,
    delete_unfinished_job_workflow,
    fail_job_stage,
    initialize_job_workflow,
    start_job_stage,
    succeed_job_stage,
)
from app.generation_promotion import promote_note_group_generation_draft
from app.models import (
    DraftMindMapRelation,
    DraftNoteGroupTopicLink,
    DraftQuestionCard,
    DraftKnowledgeNode,
    DraftStudyCard,
    DraftStudyCardKnowledgeNodeLink,
    DraftStudyCardSourceRange,
    DraftStudyCardTopicLink,
    DraftTopic,
    JOB_STAGE_CLEANED_TEXT,
    JOB_STAGE_COMPLETE,
    JOB_STAGE_EMBEDDINGS,
    JOB_STAGE_FORMATTED_TEXT,
    JOB_STAGE_MIND_MAP_TOPICS,
    JOB_STAGE_PROMOTING,
    JOB_STAGE_QUEUED,
    JOB_STAGE_QUESTION_CARDS,
    JOB_STAGE_STUDY_CARDS,
    JOB_STAGE_TITLE,
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES,
    Job,
    KNOWLEDGE_NODE_TYPES,
    MindMapConcept,
    MIND_MAP_RELATION_TYPES,
    MIND_MAP_IMPORTANCE_LEVELS,
    Module,
    NoteGroupGenerationDraft,
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
    generate_topic_knowledge_node_candidates,
    generate_note_group_title_suggestions,
    generate_question_cards,
    generate_study_cards_with_context,
    generate_topic_tree_candidate_graph,
    repair_study_card_source_ranges,
)
from app.source_ranges import find_evidence_ranges
from app.text_formatter import build_formatted_sections, sections_to_markdown
from app.vector_store import delete_study_card_embeddings, upsert_study_card_embeddings


JOB_TYPE_NOTE_GROUP_QUESTION_GENERATION = "NOTE_GROUP_QUESTION_GENERATION"
JOB_TYPE_NOTE_GROUP_AUTO_GENERATION = "NOTE_GROUP_AUTO_GENERATION"
JOB_TYPE_MIND_MAP_GENERATION = "MIND_MAP_GENERATION"


def generate_mind_map_candidate_graph(
    module_title: str,
    note_group_title: str,
    study_cards: list[dict],
    existing_concepts: list[dict] | None = None,
    existing_topics: list[dict] | None = None,
) -> dict:
    return generate_topic_tree_candidate_graph(
        module_title=module_title,
        note_group_title=note_group_title,
        study_cards=study_cards,
        existing_topics=existing_topics,
    )


class AutoJobCancelled(Exception):
    pass


class MindMapJobSuperseded(Exception):
    pass


class TopicKnowledgeNodeNeedsReview(Exception):
    pass


class SourceRangeRepairError(Exception):
    pass


def _dedupe_source_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return sorted(set(ranges), key=lambda item: (item[0], item[1]))


def _merge_source_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for start_index, end_index in sorted(ranges, key=lambda item: (item[0], item[1])):
        if start_index < 0 or end_index <= start_index:
            continue
        if not merged:
            merged.append((start_index, end_index))
            continue
        previous_start, previous_end = merged[-1]
        if start_index <= previous_end:
            merged[-1] = (previous_start, max(previous_end, end_index))
        else:
            merged.append((start_index, end_index))
    return merged


def _normalize_evidence_snippets(evidence_snippets) -> list[str]:
    if not isinstance(evidence_snippets, list):
        return []
    return [
        snippet
        for snippet in evidence_snippets
        if isinstance(snippet, str) and snippet != ""
    ]


def _find_exact_snippet_ranges(
    cleaned_text_markdown: Optional[str],
    evidence_snippets,
    *,
    require_all: bool = False,
) -> list[tuple[int, int]]:
    if not cleaned_text_markdown:
        if require_all:
            raise SourceRangeRepairError("Cleaned Text is missing")
        return []
    snippets = _normalize_evidence_snippets(evidence_snippets)
    if require_all and not snippets:
        raise SourceRangeRepairError("Repair did not return evidence_snippets")

    missing = [snippet for snippet in snippets if cleaned_text_markdown.find(snippet) == -1]
    if require_all and missing:
        raise SourceRangeRepairError("Repair returned evidence that is not exact Cleaned Text")
    ranges: list[tuple[int, int]] = []
    for snippet in snippets:
        if snippet in missing:
            continue
        start_index = cleaned_text_markdown.find(snippet)
        while start_index != -1:
            end_index = start_index + len(snippet)
            ranges.append((start_index, end_index))
            start_index = cleaned_text_markdown.find(snippet, start_index + 1)
    return _merge_source_ranges(ranges)


def _range_int(payload: dict, *keys: str) -> Optional[int]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    return None


def _verified_source_ranges_from_offsets(
    cleaned_text_markdown: str,
    evidence_snippets: list[str],
    source_ranges,
) -> list[tuple[int, int]]:
    if not isinstance(source_ranges, list) or not source_ranges:
        return []

    ranges: list[tuple[int, int]] = []
    for index, payload in enumerate(source_ranges):
        if not isinstance(payload, dict):
            raise SourceRangeRepairError("Repair returned malformed source_ranges")
        start_index = _range_int(payload, "start_index", "start")
        end_index = _range_int(payload, "end_index", "end")
        snippet = _candidate_string(payload, "snippet", "evidence_snippet", "text")
        if not snippet and index < len(evidence_snippets):
            snippet = evidence_snippets[index]
        if start_index is None or end_index is None or not snippet:
            raise SourceRangeRepairError("Repair returned incomplete source_ranges")
        if start_index < 0 or end_index <= start_index or end_index > len(cleaned_text_markdown):
            raise SourceRangeRepairError("Repair returned out-of-bounds source_ranges")
        if cleaned_text_markdown[start_index:end_index] != snippet:
            raise SourceRangeRepairError("Repair returned source_ranges that do not match Cleaned Text")
        ranges.append((start_index, end_index))
    return _dedupe_source_ranges(ranges)


def _verified_repair_source_ranges(
    cleaned_text_markdown: str,
    repair_payload: dict,
) -> list[tuple[int, int]]:
    if not isinstance(repair_payload, dict):
        raise SourceRangeRepairError("Repair response was not JSON object")
    evidence_snippets = _normalize_evidence_snippets(repair_payload.get("evidence_snippets"))
    snippet_ranges = _find_exact_snippet_ranges(
        cleaned_text_markdown,
        evidence_snippets,
        require_all=True,
    )
    offset_ranges = _verified_source_ranges_from_offsets(
        cleaned_text_markdown,
        evidence_snippets,
        repair_payload.get("source_ranges"),
    )
    ranges = _dedupe_source_ranges([*offset_ranges, *snippet_ranges])
    if not ranges:
        raise SourceRangeRepairError("Repair did not produce verified Source Ranges")
    return ranges


def _store_verified_draft_study_card_source_ranges(
    db: Session,
    draft_study_card: DraftStudyCard,
    ranges: list[tuple[int, int]],
) -> int:
    db.query(DraftStudyCardSourceRange).filter(
        DraftStudyCardSourceRange.draft_study_card_id == draft_study_card.id
    ).delete(synchronize_session=False)
    deduped_ranges = _dedupe_source_ranges(ranges)
    for start_index, end_index in deduped_ranges:
        db.add(
            DraftStudyCardSourceRange(
                draft_study_card_id=draft_study_card.id,
                start_index=start_index,
                end_index=end_index,
            )
        )
    return len(deduped_ranges)


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


def _store_draft_study_card_source_ranges(
    db: Session,
    draft_study_card: DraftStudyCard,
    cleaned_text_markdown: Optional[str],
    evidence_snippets,
) -> int:
    if not cleaned_text_markdown or not isinstance(evidence_snippets, list):
        return 0
    ranges = _find_exact_snippet_ranges(cleaned_text_markdown, evidence_snippets)
    return _store_verified_draft_study_card_source_ranges(db, draft_study_card, ranges)


def _study_card_mind_map_payloads(study_cards: list[StudyCard]) -> list[dict]:
    return [
        {
            "study_card_id": card.id,
            "title": card.title,
            "content": card.content,
            "concept_labels": sorted(chip.label for chip in card.topic_chips),
        }
        for card in study_cards
    ]


def _existing_concept_payloads(db: Session, module_id: str) -> list[dict]:
    concepts = (
        db.query(MindMapConcept)
        .filter(MindMapConcept.module_id == module_id)
        .order_by(MindMapConcept.title.asc(), MindMapConcept.id.asc())
        .all()
    )
    return [
        {
            "concept_id": concept.id,
            "title": concept.title,
            "summary": concept.summary,
            "concept_type": concept.concept_type,
            "knowledge_type": concept.knowledge_type,
            "importance": concept.importance,
            "topic_id": concept.topic_id,
        }
        for concept in concepts
    ]


def _existing_topic_payloads(db: Session, module_id: str) -> list[dict]:
    topics = (
        db.query(TopicChip)
        .filter(TopicChip.module_id == module_id)
        .order_by(TopicChip.label.asc(), TopicChip.id.asc())
        .all()
    )
    return [
        {
            "topic_id": topic.id,
            "title": topic.label,
            "summary": topic.description or "",
            "parent_topic_id": topic.parent_topic_id,
        }
        for topic in topics
    ]


def _topic_knowledge_node_candidate_payload(db: Session, topic: TopicChip) -> dict:
    context = build_topic_knowledge_node_generation_context(db, topic.id)
    existing_concepts = [
        {
            "concept_id": node["knowledge_node_id"],
            "title": node["title"],
            "summary": node["summary"],
            "knowledge_type": node["knowledge_type"],
            "importance": node["importance"],
            "topic_id": node["topic_id"],
            "context_role": "selected_topic_existing_knowledge_node",
        }
        for node in context["existing_knowledge_nodes"]
    ]
    existing_concepts.extend(
        {
            "concept_id": node["knowledge_node_id"],
            "title": node["title"],
            "summary": node["summary"],
            "knowledge_type": node["knowledge_type"],
            "importance": node["importance"],
            "topic_id": node["topic_id"],
            "context_role": "immediate_child_topic_definition",
        }
        for node in context["child_definition_context"]
    )
    return generate_topic_knowledge_node_candidates(
        module_title=topic.module.title,
        note_group_title=f"Concept: {topic.label}",
        study_cards=context["study_cards"],
        selected_topic=context["topic"],
        existing_knowledge_nodes=existing_concepts,
    )


def _mark_topic_knowledge_nodes_needs_review(topic_id: str, reason: str) -> None:
    db = SessionLocal()
    try:
        topic = db.get(TopicChip, topic_id)
        if topic:
            topic.knowledge_node_status = "needs_review"
            topic.knowledge_node_review_reason = reason
            db.commit()
    finally:
        db.close()


def _reconcile_topic_knowledge_nodes(topic_id: str) -> None:
    db = SessionLocal()
    try:
        topic = db.get(TopicChip, topic_id)
        if not topic:
            raise ValueError("Concept not found")
        candidate_payload = _topic_knowledge_node_candidate_payload(db, topic)
        regenerate_topic_knowledge_nodes(db, topic.id, candidate_payload)
        db.commit()
        if topic.knowledge_node_status == "needs_review":
            raise TopicKnowledgeNodeNeedsReview(
                topic.knowledge_node_review_reason or "Concept Knowledge Nodes need review"
            )
    except TopicKnowledgeNodeNeedsReview:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _topic_dependencies(topics: list[TopicChip], topic_ids: set[str]) -> dict[str, set[str]]:
    return {
        topic.id: {child.id for child in topic.child_topics if child.id in topic_ids}
        for topic in topics
        if topic.id in topic_ids
    }


def reconcile_note_group_topic_knowledge_nodes(
    note_group_id: str,
    *,
    only_needs_review: bool = False,
) -> dict[str, str]:
    db = SessionLocal()
    try:
        note_group = db.get(NoteGroup, note_group_id)
        if not note_group:
            raise ValueError("Note group not found")
        rows = db.execute(
            note_group_topic_chips.select().where(note_group_topic_chips.c.note_group_id == note_group_id)
        ).all()
        topic_ids = {row.chip_id for row in rows}
        if only_needs_review:
            review_topic_rows = (
                db.query(TopicChip.id)
                .filter(
                    TopicChip.id.in_(topic_ids),
                    TopicChip.knowledge_node_status == "needs_review",
                )
                .all()
            )
            topic_ids = {row[0] for row in review_topic_rows}
        if not topic_ids:
            return {}
        topics = (
            db.query(TopicChip)
            .filter(TopicChip.module_id == note_group.module_id, TopicChip.id.in_(topic_ids))
            .all()
        )
        dependencies = _topic_dependencies(topics, topic_ids)
    finally:
        db.close()

    return run_dependency_aware_topic_tasks(
        topic_ids=topic_ids,
        dependencies_by_topic_id=dependencies,
        run_topic=_reconcile_topic_knowledge_nodes,
        mark_needs_review=_mark_topic_knowledge_nodes_needs_review,
    )


def _print_topic_knowledge_console_log(message: str) -> None:
    print(f"[concept-knowledge-nodes] {message}", flush=True)


def generate_and_persist_note_group_mind_map(
    db: Session,
    note_group: NoteGroup,
    module,
    study_cards: list[StudyCard],
    ensure_active=None,
) -> None:
    candidate_topic_payload = generate_mind_map_candidate_graph(
        module_title=module.title,
        note_group_title=note_group.title or "",
        study_cards=_study_card_mind_map_payloads(study_cards),
        existing_concepts=_existing_concept_payloads(db, module.id),
        existing_topics=_existing_topic_payloads(db, module.id),
    )
    if "concepts" in candidate_topic_payload or "knowledge_nodes" in candidate_topic_payload:
        regenerate_note_group_mind_map(db, note_group.id, candidate_topic_payload)
        if ensure_active:
            ensure_active()
        db.commit()
        return

    regenerate_note_group_mind_map(
        db,
        note_group.id,
        {
            "topics": candidate_topic_payload.get("topics") or [],
            "knowledge_nodes": [],
            "relations": [],
            "study_card_topic_links": candidate_topic_payload.get("study_card_topic_links") or [],
            "study_card_knowledge_node_links": [],
        },
    )
    if ensure_active:
        ensure_active()
    db.commit()
    reconcile_note_group_topic_knowledge_nodes(note_group.id)


def _raise_if_cancelled(db: Session, job: Job) -> None:
    db.refresh(job)
    if job.status == "cancelled":
        raise AutoJobCancelled()


def _start_auto_job_stage(db: Session, job: Job, stage: str):
    _raise_if_cancelled(db, job)
    return start_job_stage(db, job, stage)


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


def _next_auto_generation_stage(job: Job) -> str:
    succeeded_stages = {
        stage.stage
        for stage in job.stages
        if stage.status == "succeeded"
    }
    for stage in JOB_STAGE_SEQUENCE:
        if stage == JOB_STAGE_QUEUED:
            continue
        if stage not in succeeded_stages:
            return stage
    return JOB_STAGE_COMPLETE


def _load_draft_study_cards(
    db: Session,
    draft: NoteGroupGenerationDraft,
) -> list[DraftStudyCard]:
    return (
        db.query(DraftStudyCard)
        .filter(DraftStudyCard.draft_id == draft.id)
        .order_by(DraftStudyCard.sort_order.asc(), DraftStudyCard.created_at.asc())
        .all()
    )


def _build_draft_study_card_context(draft_study_cards: list[DraftStudyCard]) -> list[dict]:
    return [
        {
            "id": card.id,
            "title": card.title,
            "content": card.content,
        }
        for card in draft_study_cards
    ]


def _repair_single_study_card_source_ranges(
    cleaned_text_markdown: str,
    study_card_title: Optional[str],
    study_card_content: str,
    evidence_snippets,
) -> list[tuple[int, int]]:
    repair_payload = repair_study_card_source_ranges(
        cleaned_text_markdown=cleaned_text_markdown,
        study_card_title=study_card_title,
        study_card_content=study_card_content,
        evidence_snippets=evidence_snippets,
    )
    return _verified_repair_source_ranges(cleaned_text_markdown, repair_payload)


def _repair_unmatched_study_card_source_ranges(
    cleaned_text_markdown: str,
    repair_requests: list[dict],
) -> dict[str, list[tuple[int, int]]]:
    if not repair_requests:
        return {}
    max_workers = min(5, len(repair_requests))
    repaired_ranges_by_card_id: dict[str, list[tuple[int, int]]] = {}
    executor = ThreadPoolExecutor(max_workers=max_workers)
    try:
        future_to_request = {
            executor.submit(
                _repair_single_study_card_source_ranges,
                cleaned_text_markdown,
                request["title"],
                request["content"],
                request["evidence_snippets"],
            ): request
            for request in repair_requests
        }
        pending = set(future_to_request)
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for future in done:
                request = future_to_request[future]
                try:
                    ranges = future.result()
                except Exception as exc:
                    executor.shutdown(wait=False, cancel_futures=True)
                    raise SourceRangeRepairError(
                        f"Source Range repair failed for Study Card '{request['title'] or request['card_id']}'"
                    ) from exc
                if not ranges:
                    executor.shutdown(wait=False, cancel_futures=True)
                    raise SourceRangeRepairError(
                        f"Source Range repair produced no verified ranges for Study Card '{request['title'] or request['card_id']}'"
                    )
                repaired_ranges_by_card_id[request["card_id"]] = ranges
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
    return repaired_ranges_by_card_id


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


def _candidate_string(payload: dict, *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _clear_draft_generation_artifacts(db: Session, draft: NoteGroupGenerationDraft) -> None:
    draft.title = None
    draft.suggested_titles_json = None
    draft.cleaned_text_markdown = None
    draft.formatted_sections_json = None
    draft.formatted_text = None

    db.query(DraftMindMapRelation).filter(DraftMindMapRelation.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftStudyCardKnowledgeNodeLink).filter(
        DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftStudyCardTopicLink).filter(DraftStudyCardTopicLink.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftNoteGroupTopicLink).filter(DraftNoteGroupTopicLink.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftQuestionCard).filter(DraftQuestionCard.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftKnowledgeNode).filter(DraftKnowledgeNode.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftStudyCard).filter(DraftStudyCard.draft_id == draft.id).delete(
        synchronize_session=False
    )


def _persist_draft_topic_graph(
    db: Session,
    draft: NoteGroupGenerationDraft,
    candidate_payload: dict,
) -> dict[str, tuple[str, str]]:
    db.query(DraftMindMapRelation).filter(DraftMindMapRelation.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftStudyCardTopicLink).filter(DraftStudyCardTopicLink.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftNoteGroupTopicLink).filter(DraftNoteGroupTopicLink.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.flush()

    topics = candidate_payload.get("topics") or []
    study_card_topic_links = candidate_payload.get("study_card_topic_links") or []
    relations = candidate_payload.get("relations") or []
    if not isinstance(topics, list):
        topics = []
    if not isinstance(study_card_topic_links, list):
        study_card_topic_links = []
    if not isinstance(relations, list):
        relations = []

    existing_topic_ids = {
        row[0]
        for row in db.query(TopicChip.id)
        .filter(TopicChip.module_id == draft.module_id)
        .all()
    }
    draft_study_card_ids = {
        row[0]
        for row in db.query(DraftStudyCard.id)
        .filter(DraftStudyCard.draft_id == draft.id)
        .all()
    }
    topic_targets: dict[str, tuple[str, str]] = {}
    pending_parents: list[tuple[DraftTopic, str]] = []

    def resolve_topic_target(topic_ref: str) -> Optional[tuple[str, str]]:
        if topic_ref in topic_targets:
            return topic_targets[topic_ref]
        if topic_ref in existing_topic_ids:
            return ("existing", topic_ref)
        return None

    for sort_order, payload in enumerate(topics):
        if not isinstance(payload, dict):
            continue
        temp_id = _candidate_string(payload, "temp_id", "id", "topic_id")
        title = _candidate_string(payload, "title", "label")
        if not temp_id or not title:
            continue
        matched_existing_topic_id = _candidate_string(payload, "matched_existing_topic_id", "existing_topic_id")
        if matched_existing_topic_id and matched_existing_topic_id in existing_topic_ids:
            topic_targets[temp_id] = ("existing", matched_existing_topic_id)
            continue

        draft_topic_id = str(uuid.uuid4())
        draft_topic = DraftTopic(
            id=draft_topic_id,
            draft_id=draft.id,
            module_id=draft.module_id,
            relation_endpoint_id=draft_topic_id,
            label=title,
            description=_candidate_string(payload, "summary", "description") or None,
            sort_order=sort_order,
        )
        parent_ref = _candidate_string(payload, "parent_topic_id", "parent_id")
        if parent_ref:
            pending_parents.append((draft_topic, parent_ref))
        db.add(draft_topic)
        topic_targets[temp_id] = ("draft", draft_topic.id)

    db.flush()
    for draft_topic, parent_ref in pending_parents:
        parent_target = resolve_topic_target(parent_ref)
        if parent_target:
            target_type, target_id = parent_target
            if target_type == "draft":
                draft_topic.parent_draft_topic_id = target_id
            else:
                draft_topic.parent_existing_topic_id = target_id
        else:
            continue

    linked_note_group_topics: set[tuple[str, str]] = set()
    for sort_order, (_topic_ref, target) in enumerate(topic_targets.items()):
        target_type, target_id = target
        link_key = (target_type, target_id)
        if link_key in linked_note_group_topics:
            continue
        linked_note_group_topics.add(link_key)
        kwargs = {"draft_topic_id": target_id} if target_type == "draft" else {"existing_topic_id": target_id}
        db.add(
            DraftNoteGroupTopicLink(
                draft_id=draft.id,
                module_id=draft.module_id,
                sort_order=sort_order,
                **kwargs,
            )
        )

    linked_study_card_topics: set[tuple[str, str, str]] = set()
    for sort_order, payload in enumerate(study_card_topic_links):
        if not isinstance(payload, dict):
            continue
        study_card_id = _candidate_string(payload, "study_card_id", "studyCardId")
        topic_ref = _candidate_string(payload, "topic_id", "topicId")
        topic_target = resolve_topic_target(topic_ref)
        if study_card_id not in draft_study_card_ids or not topic_target:
            continue
        target_type, target_id = topic_target
        link_key = (study_card_id, target_type, target_id)
        if link_key in linked_study_card_topics:
            continue
        linked_study_card_topics.add(link_key)
        kwargs = {"draft_topic_id": target_id} if target_type == "draft" else {"existing_topic_id": target_id}
        note_group_link_key = (target_type, target_id)
        if note_group_link_key not in linked_note_group_topics:
            linked_note_group_topics.add(note_group_link_key)
            db.add(
                DraftNoteGroupTopicLink(
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    sort_order=sort_order,
                    **kwargs,
                )
            )
        db.add(
            DraftStudyCardTopicLink(
                draft_id=draft.id,
                module_id=draft.module_id,
                draft_study_card_id=study_card_id,
                role=_candidate_string(payload, "role") or "primary",
                **kwargs,
            )
        )

    for sort_order, payload in enumerate(relations):
        if not isinstance(payload, dict):
            continue
        source_ref = _candidate_string(payload, "source_topic_id", "source_id", "source")
        target_ref = _candidate_string(payload, "target_topic_id", "target_id", "target")
        relation_type = _candidate_string(payload, "relation_type", "type") or "related_to"
        source_target = resolve_topic_target(source_ref)
        target_target = resolve_topic_target(target_ref)
        if not source_target or not target_target or relation_type not in MIND_MAP_RELATION_TYPES:
            continue
        source_type, source_id = source_target
        target_type, target_id = target_target
        relation_kwargs = {}
        relation_kwargs["source_draft_topic_id" if source_type == "draft" else "source_existing_topic_id"] = source_id
        relation_kwargs["target_draft_topic_id" if target_type == "draft" else "target_existing_topic_id"] = target_id
        db.add(
            DraftMindMapRelation(
                draft_id=draft.id,
                module_id=draft.module_id,
                relation_type=relation_type,
                label=_candidate_string(payload, "label") or None,
                sort_order=sort_order,
                **relation_kwargs,
            )
        )
    return topic_targets


def _draft_topic_payloads(db: Session, draft: NoteGroupGenerationDraft) -> list[dict]:
    topics = (
        db.query(DraftTopic)
        .filter(DraftTopic.draft_id == draft.id)
        .order_by(DraftTopic.sort_order.asc(), DraftTopic.id.asc())
        .all()
    )
    return [
        {
            "topic_id": topic.id,
            "title": topic.label,
            "summary": topic.description or "",
            "parent_topic_id": topic.parent_draft_topic_id or topic.parent_existing_topic_id,
        }
        for topic in topics
    ]


def _draft_study_card_topic_link_payloads(
    db: Session,
    draft: NoteGroupGenerationDraft,
) -> list[dict]:
    links = (
        db.query(DraftStudyCardTopicLink)
        .filter(DraftStudyCardTopicLink.draft_id == draft.id)
        .all()
    )
    return [
        {
            "study_card_id": link.draft_study_card_id,
            "topic_id": link.draft_topic_id or link.existing_topic_id,
            "role": link.role,
        }
        for link in links
        if link.draft_topic_id or link.existing_topic_id
    ]


def _pluralize_topic_label(count: int, adjective: str) -> str:
    return f"{count} {adjective} Concept" if count == 1 else f"{count} {adjective} Concepts"


def _draft_topic_reconciliation_counts(db: Session, draft: NoteGroupGenerationDraft) -> tuple[int, int]:
    draft_topic_count = db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).count()
    existing_topic_ids = {
        row[0]
        for row in db.query(DraftStudyCardTopicLink.existing_topic_id)
        .filter(
            DraftStudyCardTopicLink.draft_id == draft.id,
            DraftStudyCardTopicLink.existing_topic_id.isnot(None),
        )
        .all()
    }
    existing_topic_ids.update(
        row[0]
        for row in db.query(DraftNoteGroupTopicLink.existing_topic_id)
        .filter(
            DraftNoteGroupTopicLink.draft_id == draft.id,
            DraftNoteGroupTopicLink.existing_topic_id.isnot(None),
        )
        .all()
    )
    return draft_topic_count, len(existing_topic_ids)


def _draft_topic_target_key(target_type: str, target_id: str) -> str:
    return f"{target_type}:{target_id}"


def _split_draft_topic_target_key(target_key: str) -> tuple[str, str]:
    target_type, target_id = target_key.split(":", 1)
    return target_type, target_id


def _draft_topic_reconciliation_targets(db: Session, draft: NoteGroupGenerationDraft) -> set[str]:
    target_keys = {
        _draft_topic_target_key("draft", row[0])
        for row in db.query(DraftTopic.id).filter(DraftTopic.draft_id == draft.id).all()
    }
    existing_topic_ids = {
        row[0]
        for row in db.query(DraftStudyCardTopicLink.existing_topic_id)
        .filter(
            DraftStudyCardTopicLink.draft_id == draft.id,
            DraftStudyCardTopicLink.existing_topic_id.isnot(None),
        )
        .all()
    }
    existing_topic_ids.update(
        row[0]
        for row in db.query(DraftNoteGroupTopicLink.existing_topic_id)
        .filter(
            DraftNoteGroupTopicLink.draft_id == draft.id,
            DraftNoteGroupTopicLink.existing_topic_id.isnot(None),
        )
        .all()
    )
    existing_topic_ids.update(
        row[0]
        for row in db.query(DraftTopic.parent_existing_topic_id)
        .filter(
            DraftTopic.draft_id == draft.id,
            DraftTopic.parent_existing_topic_id.isnot(None),
        )
        .all()
    )
    target_keys.update(_draft_topic_target_key("existing", topic_id) for topic_id in existing_topic_ids)
    return target_keys


def _draft_topic_reconciliation_dependencies(
    db: Session,
    draft: NoteGroupGenerationDraft,
    target_keys: set[str],
) -> dict[str, set[str]]:
    dependencies = {target_key: set() for target_key in target_keys}
    draft_topics = db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).all()
    for topic in draft_topics:
        child_key = _draft_topic_target_key("draft", topic.id)
        if child_key not in target_keys:
            continue
        if topic.parent_draft_topic_id:
            parent_key = _draft_topic_target_key("draft", topic.parent_draft_topic_id)
            if parent_key in dependencies:
                dependencies[parent_key].add(child_key)
        if topic.parent_existing_topic_id:
            parent_key = _draft_topic_target_key("existing", topic.parent_existing_topic_id)
            if parent_key in dependencies:
                dependencies[parent_key].add(child_key)

    existing_topic_ids = [
        target_id
        for target_type, target_id in (_split_draft_topic_target_key(target_key) for target_key in target_keys)
        if target_type == "existing"
    ]
    if existing_topic_ids:
        existing_topics = (
            db.query(TopicChip)
            .filter(TopicChip.module_id == draft.module_id, TopicChip.id.in_(existing_topic_ids))
            .all()
        )
        for topic in existing_topics:
            child_key = _draft_topic_target_key("existing", topic.id)
            if child_key not in target_keys or not topic.parent_topic_id:
                continue
            parent_key = _draft_topic_target_key("existing", topic.parent_topic_id)
            if parent_key in dependencies:
                dependencies[parent_key].add(child_key)
    return dependencies


def _draft_topic_payload_for_target(db: Session, draft: NoteGroupGenerationDraft, target_key: str) -> dict:
    target_type, target_id = _split_draft_topic_target_key(target_key)
    if target_type == "draft":
        topic = (
            db.query(DraftTopic)
            .filter(DraftTopic.draft_id == draft.id, DraftTopic.id == target_id)
            .one()
        )
        return {
            "topic_id": topic.id,
            "title": topic.label,
            "summary": topic.description or "",
            "parent_topic_id": topic.parent_draft_topic_id or topic.parent_existing_topic_id,
        }
    topic = (
        db.query(TopicChip)
        .filter(TopicChip.module_id == draft.module_id, TopicChip.id == target_id)
        .one()
    )
    return {
        "topic_id": topic.id,
        "title": topic.label,
        "summary": topic.description or "",
        "parent_topic_id": topic.parent_topic_id,
    }


def _draft_child_definition_context(child_payloads: list[dict]) -> list[dict]:
    child_definitions = []
    for payload in child_payloads:
        for node in payload.get("knowledge_nodes") or []:
            if not isinstance(node, dict) or node.get("knowledge_type") != "definition":
                continue
            child_definitions.append(
                {
                    "concept_id": _candidate_string(node, "temp_id", "id", "knowledge_node_id"),
                    "title": _candidate_string(node, "title"),
                    "summary": _candidate_string(node, "summary"),
                    "knowledge_type": "definition",
                    "importance": _candidate_string(node, "importance") or "supporting",
                    "topic_id": _candidate_string(node, "topic_id", "topicId", "parent_topic_id"),
                    "context_role": "immediate_child_topic_definition",
                }
            )
    return child_definitions


def _draft_direct_study_card_context(db: Session, draft: NoteGroupGenerationDraft, target_key: str) -> list[dict]:
    target_type, target_id = _split_draft_topic_target_key(target_key)
    link_filters = [DraftStudyCardTopicLink.draft_id == draft.id]
    if target_type == "draft":
        link_filters.append(DraftStudyCardTopicLink.draft_topic_id == target_id)
    else:
        link_filters.append(DraftStudyCardTopicLink.existing_topic_id == target_id)
    links = db.query(DraftStudyCardTopicLink).filter(*link_filters).all()
    card_ids = [link.draft_study_card_id for link in links]
    if not card_ids:
        return []
    cards_by_id = {
        card.id: card
        for card in db.query(DraftStudyCard)
        .filter(DraftStudyCard.draft_id == draft.id, DraftStudyCard.id.in_(card_ids))
        .all()
    }
    return _build_draft_study_card_context([cards_by_id[card_id] for card_id in card_ids if card_id in cards_by_id])


def _draft_topic_knowledge_node_candidate_payload(
    db: Session,
    draft: NoteGroupGenerationDraft,
    module,
    note_group_title: str,
    target_key: str,
    child_payloads: list[dict],
) -> dict:
    topic_payload = _draft_topic_payload_for_target(db, draft, target_key)
    target_type, target_id = _split_draft_topic_target_key(target_key)
    study_cards = _draft_direct_study_card_context(db, draft, target_key)
    if target_type == "draft" and topic_payload.get("summary"):
        node_temp_id = f"definition:{target_id}"
        return {
            "knowledge_nodes": [
                {
                    "temp_id": node_temp_id,
                    "topic_id": target_id,
                    "title": f"{topic_payload['title']} definition",
                    "summary": topic_payload["summary"],
                    "knowledge_type": "definition",
                    "importance": "core",
                }
            ],
            "relations": [],
            "study_card_knowledge_node_links": [
                {
                    "study_card_id": card["id"],
                    "knowledge_node_id": node_temp_id,
                    "role": "primary",
                }
                for card in study_cards
            ],
        }
    existing_concepts = _draft_child_definition_context(child_payloads)
    if target_type == "existing":
        existing_concepts.extend(
            {
                "concept_id": concept.id,
                "title": concept.title,
                "summary": concept.summary,
                "knowledge_type": concept.knowledge_type,
                "importance": concept.importance,
                "topic_id": concept.topic_id,
                "context_role": "selected_topic_existing_knowledge_node",
            }
            for concept in db.query(MindMapConcept)
            .filter(MindMapConcept.module_id == draft.module_id, MindMapConcept.topic_id == target_id)
            .all()
        )
    return generate_topic_knowledge_node_candidates(
        module_title=module.title,
        note_group_title=note_group_title,
        study_cards=study_cards,
        selected_topic=topic_payload,
        existing_knowledge_nodes=existing_concepts,
    )


def _prefix_draft_knowledge_payload_refs(candidate_payload: dict, target_key: str) -> dict:
    payload = {
        "knowledge_nodes": [dict(node) for node in candidate_payload.get("knowledge_nodes") or [] if isinstance(node, dict)],
        "relations": [dict(relation) for relation in candidate_payload.get("relations") or [] if isinstance(relation, dict)],
        "study_card_knowledge_node_links": [
            dict(link)
            for link in candidate_payload.get("study_card_knowledge_node_links") or []
            if isinstance(link, dict)
        ],
    }
    ref_map = {}
    for node in payload["knowledge_nodes"]:
        temp_id = _candidate_string(node, "temp_id", "id", "knowledge_node_id")
        if not temp_id:
            continue
        prefixed_temp_id = f"{target_key}:{temp_id}"
        ref_map[temp_id] = prefixed_temp_id
        node["temp_id"] = prefixed_temp_id
    for relation in payload["relations"]:
        for key in ("source_knowledge_node_id", "target_knowledge_node_id", "source_id", "target_id", "source", "target"):
            value = relation.get(key)
            if value in ref_map:
                relation[key] = ref_map[value]
    for link in payload["study_card_knowledge_node_links"]:
        for key in ("knowledge_node_id", "knowledgeNodeId"):
            value = link.get(key)
            if value in ref_map:
                link[key] = ref_map[value]
    return payload


def _merge_draft_knowledge_payloads(candidate_payloads: list[dict]) -> dict:
    merged = {
        "knowledge_nodes": [],
        "relations": [],
        "study_card_knowledge_node_links": [],
    }
    for payload in candidate_payloads:
        merged["knowledge_nodes"].extend(payload.get("knowledge_nodes") or [])
        merged["relations"].extend(payload.get("relations") or [])
        merged["study_card_knowledge_node_links"].extend(payload.get("study_card_knowledge_node_links") or [])
    return merged


def _mark_draft_topic_target_knowledge_nodes_needs_review(draft_id: str, target_key: str, reason: str) -> None:
    target_type, target_id = _split_draft_topic_target_key(target_key)
    if target_type != "draft":
        return
    if reason.startswith("Concept reconciliation failed: "):
        reason = reason.removeprefix("Concept reconciliation failed: ")
    db = SessionLocal()
    try:
        topic = (
            db.query(DraftTopic)
            .filter(DraftTopic.draft_id == draft_id, DraftTopic.id == target_id)
            .one_or_none()
        )
        if topic:
            topic.knowledge_node_status = "needs_review"
            topic.knowledge_node_review_reason = reason
            db.commit()
    finally:
        db.close()


def _generate_draft_topic_knowledge_nodes(
    draft_id: str,
    module_id: str,
    note_group_title: str,
) -> dict:
    db = SessionLocal()
    try:
        draft = db.get(NoteGroupGenerationDraft, draft_id)
        module = db.get(Module, module_id)
        if not draft or not module:
            raise ValueError("Draft generation context not found")
        db.query(DraftMindMapRelation).filter(
            DraftMindMapRelation.draft_id == draft.id,
            (
                (DraftMindMapRelation.source_draft_knowledge_node_id.isnot(None))
                | (DraftMindMapRelation.target_draft_knowledge_node_id.isnot(None))
            ),
        ).delete(synchronize_session=False)
        db.query(DraftStudyCardKnowledgeNodeLink).filter(
            DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
        ).delete(synchronize_session=False)
        db.query(DraftKnowledgeNode).filter(DraftKnowledgeNode.draft_id == draft.id).delete(
            synchronize_session=False
        )
        for topic in db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).all():
            topic.knowledge_node_status = "not_generated"
            topic.knowledge_node_review_reason = None
        db.flush()
        target_keys = _draft_topic_reconciliation_targets(db, draft)
        dependencies = _draft_topic_reconciliation_dependencies(db, draft, target_keys)
        db.commit()
    finally:
        db.close()

    candidate_payloads_by_key: dict[str, dict] = {}
    candidate_payload_lock = Lock()

    def run_topic(target_key: str) -> None:
        topic_db = SessionLocal()
        try:
            topic_draft = topic_db.get(NoteGroupGenerationDraft, draft_id)
            topic_module = topic_db.get(Module, module_id)
            if not topic_draft or not topic_module:
                raise ValueError("Draft generation context not found")
            with candidate_payload_lock:
                child_payloads = [
                    candidate_payloads_by_key[child_key]
                    for child_key in dependencies.get(target_key, set())
                    if child_key in candidate_payloads_by_key
                ]
            candidate_payload = _draft_topic_knowledge_node_candidate_payload(
                topic_db,
                topic_draft,
                topic_module,
                note_group_title,
                target_key,
                child_payloads,
            )
            prefixed_payload = _prefix_draft_knowledge_payload_refs(candidate_payload, target_key)
            with candidate_payload_lock:
                candidate_payloads_by_key[target_key] = prefixed_payload
        finally:
            topic_db.close()

    run_dependency_aware_topic_tasks(
        topic_ids=target_keys,
        dependencies_by_topic_id=dependencies,
        run_topic=run_topic,
        mark_needs_review=lambda target_key, reason: _mark_draft_topic_target_knowledge_nodes_needs_review(
            draft_id,
            target_key,
            reason,
        ),
    )
    with candidate_payload_lock:
        return _merge_draft_knowledge_payloads(list(candidate_payloads_by_key.values()))


def _persist_draft_knowledge_graph(
    db: Session,
    draft: NoteGroupGenerationDraft,
    candidate_payload: dict,
) -> int:
    db.query(DraftMindMapRelation).filter(
        DraftMindMapRelation.draft_id == draft.id,
        (
            (DraftMindMapRelation.source_draft_knowledge_node_id.isnot(None))
            | (DraftMindMapRelation.target_draft_knowledge_node_id.isnot(None))
        ),
    ).delete(synchronize_session=False)
    db.query(DraftStudyCardKnowledgeNodeLink).filter(
        DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftKnowledgeNode).filter(DraftKnowledgeNode.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.flush()

    draft_topic_ids = {
        row[0]
        for row in db.query(DraftTopic.id)
        .filter(DraftTopic.draft_id == draft.id)
        .all()
    }
    existing_topic_ids = {
        row[0]
        for row in db.query(TopicChip.id)
        .filter(TopicChip.module_id == draft.module_id)
        .all()
    }
    draft_study_card_ids = {
        row[0]
        for row in db.query(DraftStudyCard.id)
        .filter(DraftStudyCard.draft_id == draft.id)
        .all()
    }
    node_targets: dict[str, str] = {}

    knowledge_nodes = candidate_payload.get("knowledge_nodes") or []
    if not isinstance(knowledge_nodes, list):
        knowledge_nodes = []
    for sort_order, payload in enumerate(knowledge_nodes):
        if not isinstance(payload, dict):
            continue
        temp_id = _candidate_string(payload, "temp_id", "id", "knowledge_node_id")
        topic_ref = _candidate_string(payload, "topic_id", "topicId", "parent_topic_id")
        title = _candidate_string(payload, "title")
        summary = _candidate_string(payload, "summary")
        knowledge_type = _candidate_string(payload, "knowledge_type")
        importance = _candidate_string(payload, "importance") or "supporting"
        if (
            not temp_id
            or not topic_ref
            or not title
            or not summary
            or knowledge_type not in KNOWLEDGE_NODE_TYPES
            or importance not in MIND_MAP_IMPORTANCE_LEVELS
        ):
            continue
        if topic_ref in draft_topic_ids:
            topic_kwargs = {"draft_topic_id": topic_ref}
        elif topic_ref in existing_topic_ids:
            topic_kwargs = {"existing_topic_id": topic_ref}
        else:
            continue
        node = DraftKnowledgeNode(
            draft_id=draft.id,
            module_id=draft.module_id,
            title=title,
            summary=summary,
            knowledge_type=knowledge_type,
            importance=importance,
            source_quote=_candidate_string(payload, "source_quote", "sourceQuote") or None,
            sort_order=sort_order,
            **topic_kwargs,
        )
        db.add(node)
        db.flush()
        node_targets[temp_id] = node.id
        node_targets[node.id] = node.id

    links = candidate_payload.get("study_card_knowledge_node_links") or []
    if not isinstance(links, list):
        links = []
    linked_pairs: set[tuple[str, str]] = set()
    for payload in links:
        if not isinstance(payload, dict):
            continue
        study_card_id = _candidate_string(payload, "study_card_id", "studyCardId")
        node_ref = _candidate_string(payload, "knowledge_node_id", "knowledgeNodeId")
        node_id = node_targets.get(node_ref)
        if not node_id or study_card_id not in draft_study_card_ids:
            continue
        link_key = (study_card_id, node_id)
        if link_key in linked_pairs:
            continue
        linked_pairs.add(link_key)
        db.add(
            DraftStudyCardKnowledgeNodeLink(
                draft_id=draft.id,
                draft_study_card_id=study_card_id,
                draft_knowledge_node_id=node_id,
                role=_candidate_string(payload, "role") or "primary",
            )
        )

    relations = candidate_payload.get("relations") or []
    if not isinstance(relations, list):
        relations = []
    for sort_order, payload in enumerate(relations):
        if not isinstance(payload, dict):
            continue
        source_ref = _candidate_string(payload, "source_knowledge_node_id", "source_id", "source")
        target_ref = _candidate_string(payload, "target_knowledge_node_id", "target_id", "target")
        source_id = node_targets.get(source_ref)
        target_id = node_targets.get(target_ref)
        relation_type = _candidate_string(payload, "relation_type", "type") or "related_to"
        if not source_id or not target_id or source_id == target_id or relation_type not in MIND_MAP_RELATION_TYPES:
            continue
        db.add(
            DraftMindMapRelation(
                draft_id=draft.id,
                module_id=draft.module_id,
                source_draft_knowledge_node_id=source_id,
                target_draft_knowledge_node_id=target_id,
                relation_type=relation_type,
                label=_candidate_string(payload, "label") or None,
                confidence=payload.get("confidence") if isinstance(payload.get("confidence"), (int, float)) else None,
                sort_order=sort_order,
            )
        )

    definition_topic_ids = {
        row[0]
        for row in db.query(DraftKnowledgeNode.draft_topic_id)
        .filter(
            DraftKnowledgeNode.draft_id == draft.id,
            DraftKnowledgeNode.draft_topic_id.isnot(None),
            DraftKnowledgeNode.knowledge_type == "definition",
        )
        .all()
    }
    draft_topics = db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).all()
    for topic in draft_topics:
        if topic.id in definition_topic_ids:
            topic.knowledge_node_status = "complete"
            topic.knowledge_node_review_reason = None
        elif topic.knowledge_node_status != "needs_review":
            topic.knowledge_node_status = "needs_review"
            topic.knowledge_node_review_reason = "Missing definition Knowledge Node"

    return len(node_targets) // 2


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

    def current_running_job_for_update() -> Job | None:
        return (
            db.query(Job)
            .filter(
                Job.id == job_id,
                Job.type == JOB_TYPE_MIND_MAP_GENERATION,
                Job.status == "running",
            )
            .with_for_update()
            .first()
        )

    try:
        claimed = (
            db.query(Job)
            .filter(
                Job.id == job_id,
                Job.type == JOB_TYPE_MIND_MAP_GENERATION,
                Job.status == "queued",
            )
            .update(
                {
                    Job.status: "running",
                    Job.error: None,
                },
                synchronize_session=False,
            )
        )
        if claimed != 1:
            return

        job = db.get(Job, job_id)
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
            .options(selectinload(StudyCard.topic_chips))
            .filter(StudyCard.note_group_id == note_group.id)
            .order_by(StudyCard.created_at.asc(), StudyCard.id.asc())
            .all()
        )
        if not study_cards:
            raise ValueError("No Study Cards available for Concept Mind Map generation")

        def ensure_current_job_active() -> None:
            db.expire_all()
            if not current_running_job_for_update():
                raise MindMapJobSuperseded()

        ensure_current_job_active()
        generate_and_persist_note_group_mind_map(
            db,
            note_group,
            module,
            study_cards,
            ensure_active=ensure_current_job_active,
        )
        db.expire_all()
        current_job = current_running_job_for_update()
        if not current_job:
            db.rollback()
            return

        current_job.status = "completed"
        current_job.error = None
        db.commit()
    except MindMapJobSuperseded:
        db.rollback()
        return
    except Exception as exc:
        db.rollback()
        job = current_running_job_for_update()
        if not job:
            return
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
    current_stage = JOB_STAGE_TITLE
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        note_group = job.note_group
        if not note_group:
            job.status = "failed"
            job.error = "Note group not found"
            db.commit()
            return

        note_group.generation_status = "generating"
        module = note_group.module
        subject = module.subject
        additional_instructions = note_group.additional_generation_instructions
        raw_text = (note_group.raw_text or "").strip()
        if not raw_text:
            raise ValueError("Raw text cannot be empty")

        existing_draft = (
            db.query(NoteGroupGenerationDraft)
            .filter(NoteGroupGenerationDraft.note_group_id == note_group.id)
            .one_or_none()
        )
        if existing_draft and existing_draft.job_id != job.id:
            db.delete(existing_draft)
            db.flush()

        had_existing_workflow = (
            db.query(NoteGroupGenerationDraft.id)
            .filter(NoteGroupGenerationDraft.job_id == job.id)
            .first()
            is not None
        )
        draft = initialize_job_workflow(
            db,
            job,
            raw_text,
            note_group.source,
            additional_instructions,
        )
        draft.raw_text = raw_text
        draft.unique_id = note_group.source
        draft.additional_generation_instructions = additional_instructions
        resume_stage = _next_auto_generation_stage(job)
        has_successful_generation_stage = any(
            stage.stage != JOB_STAGE_QUEUED and stage.status == "succeeded"
            for stage in job.stages
        )
        if (
            resume_stage == JOB_STAGE_TITLE
            and (not had_existing_workflow or not has_successful_generation_stage)
        ):
            _clear_draft_generation_artifacts(db, draft)
        db.commit()

        stage_order = {stage: index for index, stage in enumerate(JOB_STAGE_SEQUENCE)}

        def should_run(stage: str) -> bool:
            return stage_order[resume_stage] <= stage_order[stage]

        title = draft.title or ""
        cleaned_text_markdown = draft.cleaned_text_markdown or ""
        draft_study_cards = _load_draft_study_cards(db, draft)
        study_card_context = _build_draft_study_card_context(draft_study_cards)
        study_card_contents = [card.content for card in draft_study_cards]

        if should_run(JOB_STAGE_TITLE):
            current_stage = JOB_STAGE_TITLE
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
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
            _raise_if_cancelled(db, job)
            draft.title = title
            if suggestions:
                draft.suggested_titles_json = json.dumps(suggestions[:3])
            succeed_job_stage(db, job, current_stage, message="Draft title generated")
            db.commit()
            _raise_if_cancelled(db, job)
        elif not title:
            raise ValueError("Draft title missing for resumed generation stage")

        if should_run(JOB_STAGE_CLEANED_TEXT):
            current_stage = JOB_STAGE_CLEANED_TEXT
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
            cleaned_text_markdown = generate_cleaned_text_markdown(raw_text)
            _raise_if_cancelled(db, job)
            draft.cleaned_text_markdown = cleaned_text_markdown
            succeed_job_stage(db, job, current_stage, message="Draft Cleaned Text generated")
            db.commit()
            _raise_if_cancelled(db, job)
        elif not cleaned_text_markdown:
            raise ValueError("Draft Cleaned Text missing for resumed generation stage")

        if should_run(JOB_STAGE_STUDY_CARDS):
            current_stage = JOB_STAGE_STUDY_CARDS
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
            study_card_payloads = generate_study_cards_with_context(
                module_title=module.title,
                module_description=module.description,
                note_group_title=title or note_group.title or "",
                raw_text=cleaned_text_markdown,
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

            db.query(DraftStudyCard).filter(DraftStudyCard.draft_id == draft.id).delete(
                synchronize_session=False
            )
            db.flush()
            draft_study_cards = []
            card_payload_pairs = []
            for sort_order, payload in enumerate(study_card_payloads):
                content = (payload.get("content") or "").strip()
                if not content:
                    continue
                card_title = payload.get("title")
                card = DraftStudyCard(
                    draft_id=draft.id,
                    title=card_title,
                    content=content,
                    sort_order=sort_order,
                )
                db.add(card)
                draft_study_cards.append(card)
                card_payload_pairs.append((card, payload))

            if not draft_study_cards:
                raise ValueError("Generated study cards were empty")

            _raise_if_cancelled(db, job)
            db.flush()
            repair_requests = []
            for card, payload in card_payload_pairs:
                stored_range_count = _store_draft_study_card_source_ranges(
                    db,
                    card,
                    cleaned_text_markdown,
                    payload.get("evidence_snippets"),
                )
                if card.content.strip() and stored_range_count == 0:
                    repair_requests.append(
                        {
                            "card_id": card.id,
                            "title": card.title,
                            "content": card.content,
                            "evidence_snippets": payload.get("evidence_snippets"),
                        }
                    )
            if repair_requests:
                repaired_ranges_by_card_id = _repair_unmatched_study_card_source_ranges(
                    cleaned_text_markdown,
                    repair_requests,
                )
                cards_by_id = {card.id: card for card, _payload in card_payload_pairs}
                for card_id, ranges in repaired_ranges_by_card_id.items():
                    card = cards_by_id.get(card_id)
                    if not card:
                        continue
                    _store_verified_draft_study_card_source_ranges(db, card, ranges)
                if len(repaired_ranges_by_card_id) != len(repair_requests):
                    raise SourceRangeRepairError("Source Range repair did not return every unmatched Study Card")
                append_job_log(
                    db,
                    job,
                    current_stage,
                    f"Repaired Source Ranges for {len(repair_requests)} Study Cards",
                    {"repair_count": len(repair_requests)},
                )
            study_card_context = _build_draft_study_card_context(draft_study_cards)
            study_card_contents = [card.content for card in draft_study_cards]
            succeed_job_stage(
                db,
                job,
                current_stage,
                message=f"Created {len(draft_study_cards)} draft Study Cards",
                progress_current=len(draft_study_cards),
                progress_total=len(draft_study_cards),
            )
            db.commit()
            _raise_if_cancelled(db, job)
        elif not draft_study_cards:
            raise ValueError("Draft Study Cards missing for resumed generation stage")

        if should_run(JOB_STAGE_FORMATTED_TEXT):
            current_stage = JOB_STAGE_FORMATTED_TEXT
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
            raw_sections = []
            try:
                raw_sections = generate_formatted_sections(raw_text, study_card_context)
            except Exception:
                raw_sections = []
            formatted_sections = build_formatted_sections(raw_sections, study_card_context)
            _raise_if_cancelled(db, job)
            draft.formatted_sections_json = json.dumps(formatted_sections)
            draft.formatted_text = sections_to_markdown(formatted_sections)
            succeed_job_stage(db, job, current_stage, message="Draft Formatted Text generated")
            db.commit()
            _raise_if_cancelled(db, job)

        if should_run(JOB_STAGE_EMBEDDINGS):
            current_stage = JOB_STAGE_EMBEDDINGS
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
            embeddings = embed_texts(study_card_contents)
            if len(embeddings) != len(draft_study_cards):
                raise ValueError(
                    f"Expected {len(draft_study_cards)} draft Study Card embeddings, received {len(embeddings)}"
                )
            _raise_if_cancelled(db, job)
            for card, embedding in zip(draft_study_cards, embeddings):
                card.embedding_json = json.dumps(list(embedding))
            succeed_job_stage(
                db,
                job,
                current_stage,
                message=f"Prepared {len(embeddings)} draft Study Card embeddings",
                progress_current=len(embeddings),
                progress_total=len(draft_study_cards),
            )
            db.commit()
            _raise_if_cancelled(db, job)

        if should_run(JOB_STAGE_QUESTION_CARDS):
            current_stage = JOB_STAGE_QUESTION_CARDS
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
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
            _raise_if_cancelled(db, job)
            draft_study_card_ids = {card.id for card in draft_study_cards}
            db.query(DraftQuestionCard).filter(DraftQuestionCard.draft_id == draft.id).delete(
                synchronize_session=False
            )
            created = 0
            if question_payloads:
                for sort_order, payload in enumerate(question_payloads):
                    normalized = _normalize_question_payload(payload)
                    if not normalized:
                        continue
                    draft_refs = [
                        ref for ref in normalized["study_card_refs"] if ref in draft_study_card_ids
                    ]
                    if not draft_refs:
                        continue
                    question_card = DraftQuestionCard(
                        draft_id=draft.id,
                        type=normalized["type"],
                        prompt=normalized["prompt"],
                        options_json=json.dumps(normalized["options"]),
                        correct_option_indices_json=json.dumps(
                            normalized["correct_option_indices"]
                        ),
                        option_explanations_json=json.dumps(
                            normalized.get("option_explanations") or []
                        ),
                        study_card_refs_json=json.dumps(draft_refs),
                        sort_order=sort_order,
                    )
                    db.add(question_card)
                    created += 1

            succeed_job_stage(
                db,
                job,
                current_stage,
                message=f"Created {created} draft Question Cards",
                progress_current=created,
                progress_total=len(question_payloads),
            )
            db.commit()
            _raise_if_cancelled(db, job)

        if should_run(JOB_STAGE_MIND_MAP_TOPICS):
            current_stage = JOB_STAGE_MIND_MAP_TOPICS
            _start_auto_job_stage(db, job, current_stage)
            db.commit()
            candidate_topic_payload = generate_mind_map_candidate_graph(
                module_title=module.title,
                note_group_title=title or note_group.title or "",
                study_cards=[
                    {
                        "study_card_id": card["id"],
                        "title": card["title"],
                        "content": card["content"],
                        "concept_labels": [],
                    }
                    for card in study_card_context
                ],
                existing_topics=_existing_topic_payloads(db, module.id),
            )
            _raise_if_cancelled(db, job)
            _persist_draft_topic_graph(db, draft, candidate_topic_payload)
            draft_topic_count = db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).count()
            succeed_job_stage(
                db,
                job,
                current_stage,
                message=f"Prepared {draft_topic_count} draft Concepts",
                progress_current=draft_topic_count,
                progress_total=draft_topic_count,
            )
            db.commit()
            _raise_if_cancelled(db, job)

        if should_run(JOB_STAGE_TOPIC_KNOWLEDGE_NODES):
            current_stage = JOB_STAGE_TOPIC_KNOWLEDGE_NODES
            _start_auto_job_stage(db, job, current_stage)
            reconciliation_draft_topic_count, reconciliation_existing_topic_count = (
                _draft_topic_reconciliation_counts(db, draft)
            )
            append_job_log(
                db,
                job,
                current_stage,
                "Reconciling Concept Knowledge Nodes for "
                f"{_pluralize_topic_label(reconciliation_draft_topic_count, 'draft')} "
                "and "
                f"{_pluralize_topic_label(reconciliation_existing_topic_count, 'existing')}",
                {
                    "draft_topic_count": reconciliation_draft_topic_count,
                    "existing_topic_count": reconciliation_existing_topic_count,
                },
            )
            db.commit()
            try:
                batch_started_at = time.monotonic()
                _print_topic_knowledge_console_log(
                    "Draft Concept Knowledge Nodes batch started "
                    f"draft_concepts={reconciliation_draft_topic_count} "
                    f"existing_concepts={reconciliation_existing_topic_count}"
                )
                knowledge_payload = _generate_draft_topic_knowledge_nodes(
                    draft.id,
                    module.id,
                    title or note_group.title or "",
                )
                _raise_if_cancelled(db, job)
                draft_knowledge_count = _persist_draft_knowledge_graph(db, draft, knowledge_payload)
                _print_topic_knowledge_console_log(
                    "Draft Concept Knowledge Nodes batch completed "
                    f"elapsed_seconds={time.monotonic() - batch_started_at:.2f} "
                    f"knowledge_nodes={draft_knowledge_count}"
                )
                append_job_log(
                    db,
                    job,
                    current_stage,
                    f"Prepared {draft_knowledge_count} draft Concept Knowledge Nodes",
                    {"knowledge_node_count": draft_knowledge_count},
                )
            except Exception as exc:
                _print_topic_knowledge_console_log(
                    "Draft Concept Knowledge Nodes batch failed "
                    f"elapsed_seconds={time.monotonic() - batch_started_at:.2f} "
                    f"reason={exc}"
                )
                for draft_topic in db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).all():
                    draft_topic.knowledge_node_status = "needs_review"
                    draft_topic.knowledge_node_review_reason = str(exc)
                append_job_log(
                    db,
                    job,
                    current_stage,
                    "Draft Concept Knowledge Nodes need review",
                    {"level": "warning", "reason": str(exc)},
                )
            _raise_if_cancelled(db, job)
            succeed_job_stage(
                db,
                job,
                current_stage,
                message="Draft Concept Knowledge Node stage complete",
            )
            db.commit()
            _raise_if_cancelled(db, job)

        current_stage = JOB_STAGE_PROMOTING
        _start_auto_job_stage(db, job, current_stage)
        db.commit()
        _raise_if_cancelled(db, job)
        promotion_summary = promote_note_group_generation_draft(db, job)
        _raise_if_cancelled(db, job)
        succeed_job_stage(
            db,
            job,
            current_stage,
            message="Draft promoted to live Note Group",
            progress_current=promotion_summary.get("study_card_count"),
            progress_total=promotion_summary.get("study_card_count"),
        )
        current_stage = JOB_STAGE_COMPLETE
        succeed_job_stage(db, job, current_stage, message="Generation complete")
        delete_job_and_draft(db, job)
        db.commit()
    except AutoJobCancelled:
        db.rollback()
        job = db.get(Job, job_id)
        if job:
            if job.error == JOB_DELETE_REQUESTED_ERROR:
                delete_unfinished_job_workflow(db, job)
            else:
                cancel_job_workflow(db, job, "Generation cancelled")
            db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(Job, job_id)
        was_cancelled = False
        if job:
            try:
                db.refresh(job)
                if job.status == "cancelled":
                    was_cancelled = True
                    if job.error == JOB_DELETE_REQUESTED_ERROR:
                        delete_unfinished_job_workflow(db, job)
                    else:
                        cancel_job_workflow(db, job, "Generation cancelled")
                else:
                    fail_job_stage(db, job, current_stage, str(exc))
            except Exception:
                job.status = "failed"
                job.error = str(exc)
        if note_group:
            note_group = db.get(NoteGroup, note_group.id)
        if note_group:
            note_group.generation_status = "cancelled" if was_cancelled else "failed"
        db.commit()
    finally:
        db.close()
