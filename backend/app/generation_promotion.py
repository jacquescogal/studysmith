import json
import uuid
from datetime import datetime
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from app.fsrs_utils import initialize_question_card
from app.mind_map import _legacy_concept_type_for_knowledge_type, _unique_slug, slugify_concept_title
from app.models import (
    DraftKnowledgeNode,
    DraftMindMapRelation,
    DraftNoteGroupTopicLink,
    DraftQuestionCard,
    DraftStudyCard,
    DraftStudyCardKnowledgeNodeLink,
    DraftStudyCardSourceRange,
    DraftStudyCardTopicLink,
    DraftTopic,
    Job,
    MindMapConcept,
    MindMapRelation,
    NoteGroup,
    NoteGroupGenerationDraft,
    NoteGroupMindMapConcept,
    QuestionCard,
    StudyCard,
    StudyCardSourceRange,
    StudyCardMindMapConcept,
    TopicChip,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.vector_store import delete_study_card_embeddings, upsert_study_card_embeddings


def _json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _candidate_concept_ids_for_cleanup(
    db: Session,
    module_id: str,
    note_group_id: str,
    study_card_ids: Sequence[str],
) -> set[str]:
    concept_ids = {
        row[0]
        for row in db.query(NoteGroupMindMapConcept.concept_id)
        .filter(NoteGroupMindMapConcept.note_group_id == note_group_id)
        .all()
    }
    if study_card_ids:
        concept_ids.update(
            row[0]
            for row in db.query(StudyCardMindMapConcept.concept_id)
            .filter(StudyCardMindMapConcept.study_card_id.in_(study_card_ids))
            .all()
        )
    relation_rows = (
        db.query(MindMapRelation.source_concept_id, MindMapRelation.target_concept_id)
        .filter(
            MindMapRelation.module_id == module_id,
            MindMapRelation.source_note_group_id == note_group_id,
        )
        .all()
    )
    for source_id, target_id in relation_rows:
        concept_ids.add(source_id)
        concept_ids.add(target_id)
    return concept_ids


def _delete_orphan_concepts(db: Session, module_id: str, concept_ids: Iterable[str]) -> None:
    remaining_ids = {concept_id for concept_id in concept_ids if concept_id}
    if not remaining_ids:
        return

    linked_ids = {
        row[0]
        for row in db.query(NoteGroupMindMapConcept.concept_id)
        .filter(
            NoteGroupMindMapConcept.module_id == module_id,
            NoteGroupMindMapConcept.concept_id.in_(remaining_ids),
        )
        .all()
    }
    linked_ids.update(
        row[0]
        for row in db.query(StudyCardMindMapConcept.concept_id)
        .filter(
            StudyCardMindMapConcept.module_id == module_id,
            StudyCardMindMapConcept.concept_id.in_(remaining_ids),
        )
        .all()
    )
    linked_ids.update(
        row[0]
        for row in db.query(MindMapRelation.source_concept_id)
        .filter(
            MindMapRelation.module_id == module_id,
            MindMapRelation.source_concept_id.in_(remaining_ids),
        )
        .all()
    )
    linked_ids.update(
        row[0]
        for row in db.query(MindMapRelation.target_concept_id)
        .filter(
            MindMapRelation.module_id == module_id,
            MindMapRelation.target_concept_id.in_(remaining_ids),
        )
        .all()
    )
    orphan_ids = remaining_ids - linked_ids
    if orphan_ids:
        db.query(MindMapConcept).filter(
            MindMapConcept.module_id == module_id,
            MindMapConcept.id.in_(orphan_ids),
        ).delete(synchronize_session=False)


def _clear_live_note_group_artifacts(db: Session, note_group: NoteGroup) -> None:
    study_card_ids = [
        row[0]
        for row in db.query(StudyCard.id)
        .filter(StudyCard.note_group_id == note_group.id)
        .all()
    ]
    cleanup_concept_ids = _candidate_concept_ids_for_cleanup(
        db,
        note_group.module_id,
        note_group.id,
        study_card_ids,
    )

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
        db.query(StudyCardMindMapConcept).filter(
            StudyCardMindMapConcept.study_card_id.in_(study_card_ids)
        ).delete(synchronize_session=False)

    db.execute(
        note_group_topic_chips.delete().where(
            note_group_topic_chips.c.note_group_id == note_group.id
        )
    )
    db.query(NoteGroupMindMapConcept).filter(
        NoteGroupMindMapConcept.note_group_id == note_group.id
    ).delete(synchronize_session=False)
    db.query(MindMapRelation).filter(
        MindMapRelation.source_note_group_id == note_group.id
    ).delete(synchronize_session=False)
    db.query(QuestionCard).filter(QuestionCard.note_group_id == note_group.id).delete(
        synchronize_session=False
    )
    db.query(StudyCard).filter(StudyCard.note_group_id == note_group.id).delete(
        synchronize_session=False
    )
    db.flush()
    _delete_orphan_concepts(db, note_group.module_id, cleanup_concept_ids)
    db.flush()


def _topic_by_slug(db: Session, module_id: str) -> dict[str, TopicChip]:
    topics = db.query(TopicChip).filter(TopicChip.module_id == module_id).all()
    return {slugify_concept_title(topic.label): topic for topic in topics}


def _resolve_topic_status(topic: TopicChip, draft_topic: DraftTopic) -> None:
    topic.knowledge_node_status = draft_topic.knowledge_node_status
    topic.knowledge_node_review_reason = draft_topic.knowledge_node_review_reason


def _promote_topics(db: Session, draft: NoteGroupGenerationDraft) -> dict[str, str]:
    topic_id_by_draft_id: dict[str, str] = {}
    topics_by_slug = _topic_by_slug(db, draft.module_id)
    draft_topics = (
        db.query(DraftTopic)
        .filter(DraftTopic.draft_id == draft.id)
        .order_by(DraftTopic.sort_order.asc(), DraftTopic.id.asc())
        .all()
    )

    for draft_topic in draft_topics:
        if draft_topic.existing_topic_id:
            topic = db.get(TopicChip, draft_topic.existing_topic_id)
            if topic is None or topic.module_id != draft.module_id:
                raise ValueError(f"Draft Concept references missing Concept: {draft_topic.existing_topic_id}")
            _resolve_topic_status(topic, draft_topic)
            topic_id_by_draft_id[draft_topic.id] = topic.id
            continue

        slug = slugify_concept_title(draft_topic.label)
        topic = topics_by_slug.get(slug)
        if topic is None:
            topic = TopicChip(
                id=str(uuid.uuid4()),
                module_id=draft.module_id,
                label=draft_topic.label,
                sort_order=draft_topic.sort_order,
            )
            db.add(topic)
            db.flush()
            topics_by_slug[slug] = topic
        else:
            topic.label = draft_topic.label
            topic.description = None
            topic.sort_order = draft_topic.sort_order
        _resolve_topic_status(topic, draft_topic)
        topic_id_by_draft_id[draft_topic.id] = topic.id

    db.flush()
    for draft_topic in draft_topics:
        topic = db.get(TopicChip, topic_id_by_draft_id[draft_topic.id])
        if draft_topic.parent_existing_topic_id:
            topic.parent_topic_id = draft_topic.parent_existing_topic_id
        elif draft_topic.parent_draft_topic_id:
            topic.parent_topic_id = topic_id_by_draft_id.get(draft_topic.parent_draft_topic_id)

    return topic_id_by_draft_id


def _resolve_topic_id(
    topic_id_by_draft_id: dict[str, str],
    draft_topic_id: str | None = None,
    existing_topic_id: str | None = None,
) -> str | None:
    if existing_topic_id:
        return existing_topic_id
    if draft_topic_id:
        return topic_id_by_draft_id.get(draft_topic_id)
    return None


def _promote_study_cards(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
) -> tuple[dict[str, str], dict[str, StudyCard]]:
    draft_cards = (
        db.query(DraftStudyCard)
        .filter(DraftStudyCard.draft_id == draft.id)
        .order_by(DraftStudyCard.sort_order.asc(), DraftStudyCard.id.asc())
        .all()
    )
    study_card_id_by_draft_id: dict[str, str] = {}
    live_cards_by_draft_id: dict[str, StudyCard] = {}

    for draft_card in draft_cards:
        live_card = StudyCard(
            id=str(uuid.uuid4()),
            note_group_id=note_group.id,
            title=draft_card.title,
            content=draft_card.content,
        )
        db.add(live_card)
        db.flush()
        study_card_id_by_draft_id[draft_card.id] = live_card.id
        live_cards_by_draft_id[draft_card.id] = live_card

        source_ranges = (
            db.query(DraftStudyCardSourceRange)
            .filter(DraftStudyCardSourceRange.draft_study_card_id == draft_card.id)
            .order_by(DraftStudyCardSourceRange.start_index.asc(), DraftStudyCardSourceRange.id.asc())
            .all()
        )
        for source_range in source_ranges:
            db.add(
                StudyCardSourceRange(
                    note_group_id=note_group.id,
                    study_card_id=live_card.id,
                    start_index=source_range.start_index,
                    end_index=source_range.end_index,
                )
            )

    return study_card_id_by_draft_id, live_cards_by_draft_id


def _promote_question_cards(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
    study_card_id_by_draft_id: dict[str, str],
) -> int:
    created = 0
    draft_questions = (
        db.query(DraftQuestionCard)
        .filter(DraftQuestionCard.draft_id == draft.id)
        .order_by(DraftQuestionCard.sort_order.asc(), DraftQuestionCard.id.asc())
        .all()
    )
    for draft_question in draft_questions:
        live_refs = [
            study_card_id_by_draft_id[ref]
            for ref in _json_list(draft_question.study_card_refs_json)
            if ref in study_card_id_by_draft_id
        ]
        if not live_refs:
            continue
        question = QuestionCard(
            id=str(uuid.uuid4()),
            note_group_id=note_group.id,
            type=draft_question.type,
            prompt=draft_question.prompt,
            options_json=draft_question.options_json,
            correct_option_indices_json=draft_question.correct_option_indices_json,
            option_explanations_json=draft_question.option_explanations_json,
            study_card_refs_json=json.dumps(live_refs),
        )
        initialize_question_card(question)
        db.add(question)
        created += 1
    return created


def _promote_topic_links(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
    topic_id_by_draft_id: dict[str, str],
    study_card_id_by_draft_id: dict[str, str],
) -> set[str]:
    note_group_topic_ids: set[str] = set()
    for link in (
        db.query(DraftNoteGroupTopicLink)
        .filter(DraftNoteGroupTopicLink.draft_id == draft.id)
        .order_by(DraftNoteGroupTopicLink.sort_order.asc(), DraftNoteGroupTopicLink.id.asc())
        .all()
    ):
        topic_id = _resolve_topic_id(topic_id_by_draft_id, link.draft_topic_id, link.existing_topic_id)
        if topic_id and topic_id not in note_group_topic_ids:
            note_group_topic_ids.add(topic_id)
            db.execute(
                note_group_topic_chips.insert().values(
                    note_group_id=note_group.id,
                    chip_id=topic_id,
                )
            )

    study_card_topic_pairs: set[tuple[str, str]] = set()
    for link in db.query(DraftStudyCardTopicLink).filter(DraftStudyCardTopicLink.draft_id == draft.id).all():
        study_card_id = study_card_id_by_draft_id.get(link.draft_study_card_id)
        topic_id = _resolve_topic_id(topic_id_by_draft_id, link.draft_topic_id, link.existing_topic_id)
        if not study_card_id or not topic_id:
            continue
        if topic_id not in note_group_topic_ids:
            note_group_topic_ids.add(topic_id)
            db.execute(
                note_group_topic_chips.insert().values(
                    note_group_id=note_group.id,
                    chip_id=topic_id,
                )
            )
        pair = (study_card_id, topic_id)
        if pair in study_card_topic_pairs:
            continue
        study_card_topic_pairs.add(pair)
        db.execute(
            study_card_topic_chips.insert().values(
                study_card_id=study_card_id,
                chip_id=topic_id,
            )
        )
    return note_group_topic_ids


def _concepts_by_slug(db: Session, module_id: str) -> dict[str, MindMapConcept]:
    return {
        concept.slug: concept
        for concept in db.query(MindMapConcept).filter(MindMapConcept.module_id == module_id).all()
    }


def _find_existing_topic_knowledge_concept(
    db: Session,
    module_id: str,
    topic_id: str,
    title: str,
    knowledge_type: str,
) -> MindMapConcept | None:
    slug = slugify_concept_title(title)
    concepts = (
        db.query(MindMapConcept)
        .filter(
            MindMapConcept.module_id == module_id,
            MindMapConcept.topic_id == topic_id,
        )
        .all()
    )
    for concept in concepts:
        if concept.knowledge_type and concept.knowledge_type != knowledge_type:
            continue
        if concept.slug == slug or slugify_concept_title(concept.title) == slug:
            return concept
    return None


def _upsert_note_group_concept_link(
    db: Session,
    note_group: NoteGroup,
    concept_id: str,
    seen_ids: set[str],
) -> None:
    if concept_id in seen_ids:
        return
    seen_ids.add(concept_id)
    exists = (
        db.query(NoteGroupMindMapConcept)
        .filter(
            NoteGroupMindMapConcept.module_id == note_group.module_id,
            NoteGroupMindMapConcept.note_group_id == note_group.id,
            NoteGroupMindMapConcept.concept_id == concept_id,
        )
        .first()
    )
    if exists is None:
        db.add(
            NoteGroupMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group.id,
                concept_id=concept_id,
            )
        )


def _promote_knowledge_nodes(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
    topic_id_by_draft_id: dict[str, str],
    graph_concept_ids: set[str],
) -> dict[str, str]:
    concept_id_by_draft_node_id: dict[str, str] = {}
    concepts_by_slug = _concepts_by_slug(db, draft.module_id)
    note_group_concept_ids: set[str] = set()
    draft_nodes = (
        db.query(DraftKnowledgeNode)
        .filter(DraftKnowledgeNode.draft_id == draft.id)
        .order_by(DraftKnowledgeNode.sort_order.asc(), DraftKnowledgeNode.id.asc())
        .all()
    )
    for draft_node in draft_nodes:
        topic_id = _resolve_topic_id(topic_id_by_draft_id, draft_node.draft_topic_id, draft_node.existing_topic_id)
        if not topic_id:
            continue
        knowledge_type = draft_node.knowledge_type or "definition"
        importance = draft_node.importance or "supporting"
        concept = _find_existing_topic_knowledge_concept(
            db,
            draft.module_id,
            topic_id,
            draft_node.title,
            knowledge_type,
        )
        if concept is None:
            slug = _unique_slug(concepts_by_slug, slugify_concept_title(draft_node.title))
            concept = MindMapConcept(
                id=str(uuid.uuid4()),
                module_id=draft.module_id,
                topic_id=topic_id,
                slug=slug,
                title=draft_node.title,
                summary=draft_node.summary,
                concept_type=_legacy_concept_type_for_knowledge_type(knowledge_type),
                knowledge_type=knowledge_type,
                importance=importance,
                source_quote=draft_node.source_quote,
            )
            db.add(concept)
            db.flush()
            concepts_by_slug[concept.slug] = concept
        else:
            concept.title = draft_node.title
            concept.summary = draft_node.summary
            concept.concept_type = _legacy_concept_type_for_knowledge_type(knowledge_type)
            concept.knowledge_type = knowledge_type
            concept.importance = importance
            concept.source_quote = draft_node.source_quote
        concept_id_by_draft_node_id[draft_node.id] = concept.id
        graph_concept_ids.add(concept.id)
        _upsert_note_group_concept_link(
            db,
            note_group,
            concept.id,
            note_group_concept_ids,
        )
    return concept_id_by_draft_node_id


def _topic_relation_concept(
    db: Session,
    note_group: NoteGroup,
    topic_id: str,
    concepts_by_slug: dict[str, MindMapConcept],
    graph_concept_ids: set[str],
) -> str | None:
    topic = db.get(TopicChip, topic_id)
    if topic is None:
        return None
    slug = slugify_concept_title(topic.label)
    concept = concepts_by_slug.get(slug)
    if concept is None:
        concept = MindMapConcept(
            id=str(uuid.uuid4()),
            module_id=note_group.module_id,
            slug=_unique_slug(concepts_by_slug, slug),
            title=topic.label,
            summary=topic.description or topic.label,
            concept_type="topic",
            knowledge_type=None,
            importance="core",
        )
        db.add(concept)
        db.flush()
        concepts_by_slug[concept.slug] = concept
    graph_concept_ids.add(concept.id)
    return concept.id


def _promote_study_card_knowledge_node_links(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
    study_card_id_by_draft_id: dict[str, str],
    concept_id_by_draft_node_id: dict[str, str],
    graph_concept_ids: set[str],
) -> None:
    seen_pairs: set[tuple[str, str]] = set()
    for link in db.query(DraftStudyCardKnowledgeNodeLink).filter(
        DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
    ):
        study_card_id = study_card_id_by_draft_id.get(link.draft_study_card_id)
        concept_id = concept_id_by_draft_node_id.get(link.draft_knowledge_node_id)
        if not study_card_id or not concept_id:
            continue
        pair = (study_card_id, concept_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        graph_concept_ids.add(concept_id)
        db.add(
            StudyCardMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group.id,
                study_card_id=study_card_id,
                concept_id=concept_id,
                role=link.role,
            )
        )


def _promote_relations(
    db: Session,
    draft: NoteGroupGenerationDraft,
    note_group: NoteGroup,
    topic_id_by_draft_id: dict[str, str],
    concept_id_by_draft_node_id: dict[str, str],
    graph_concept_ids: set[str],
) -> None:
    concepts_by_slug = _concepts_by_slug(db, draft.module_id)

    def resolve_endpoint(
        draft_topic_id: str | None,
        existing_topic_id: str | None,
        draft_node_id: str | None,
    ) -> str | None:
        if draft_node_id:
            return concept_id_by_draft_node_id.get(draft_node_id)
        topic_id = _resolve_topic_id(topic_id_by_draft_id, draft_topic_id, existing_topic_id)
        if topic_id:
            return _topic_relation_concept(db, note_group, topic_id, concepts_by_slug, graph_concept_ids)
        return None

    seen_relations: set[tuple[str, str, str]] = set()
    for relation in (
        db.query(DraftMindMapRelation)
        .filter(DraftMindMapRelation.draft_id == draft.id)
        .order_by(DraftMindMapRelation.sort_order.asc(), DraftMindMapRelation.id.asc())
        .all()
    ):
        source_id = resolve_endpoint(
            relation.source_draft_topic_id,
            relation.source_existing_topic_id,
            relation.source_draft_knowledge_node_id,
        )
        target_id = resolve_endpoint(
            relation.target_draft_topic_id,
            relation.target_existing_topic_id,
            relation.target_draft_knowledge_node_id,
        )
        if not source_id or not target_id or source_id == target_id:
            continue
        relation_key = (source_id, target_id, relation.relation_type)
        if relation_key in seen_relations:
            continue
        seen_relations.add(relation_key)
        graph_concept_ids.add(source_id)
        graph_concept_ids.add(target_id)
        db.add(
            MindMapRelation(
                id=str(uuid.uuid4()),
                module_id=note_group.module_id,
                source_concept_id=source_id,
                target_concept_id=target_id,
                relation_type=relation.relation_type,
                label=relation.label,
                confidence=relation.confidence if relation.confidence is not None else 1.0,
                source_note_group_id=note_group.id,
            )
        )


def _promote_embeddings(
    db: Session,
    draft: NoteGroupGenerationDraft,
    live_cards_by_draft_id: dict[str, StudyCard],
) -> int:
    records = []
    for draft_card_id, live_card in live_cards_by_draft_id.items():
        draft_card = db.get(DraftStudyCard, draft_card_id)
        embedding = _json_list(draft_card.embedding_json if draft_card else None)
        if not embedding:
            continue
        records.append((live_card, draft.module_id, embedding))
    upsert_study_card_embeddings(db, records)
    return len(records)


def promote_note_group_generation_draft(db: Session, job: Job) -> dict:
    draft = job.generation_draft
    if draft is None:
        draft = (
            db.query(NoteGroupGenerationDraft)
            .filter(NoteGroupGenerationDraft.job_id == job.id)
            .one_or_none()
        )
    if draft is None:
        raise ValueError("Job has no generation draft to promote")
    note_group = db.get(NoteGroup, draft.note_group_id)
    if note_group is None:
        raise ValueError("Draft Note Group not found")

    _clear_live_note_group_artifacts(db, note_group)

    note_group.title = draft.title or note_group.title
    note_group.suggested_titles_json = draft.suggested_titles_json
    note_group.cleaned_text_markdown = draft.cleaned_text_markdown
    note_group.formatted_sections_json = draft.formatted_sections_json
    note_group.formatted_text = draft.formatted_text
    note_group.generation_status = "complete"
    note_group.mind_map_status = "complete"
    note_group.mind_map_stale = False
    note_group.mind_map_generated_at = datetime.utcnow()

    study_card_id_by_draft_id, live_cards_by_draft_id = _promote_study_cards(db, draft, note_group)
    question_count = _promote_question_cards(db, draft, note_group, study_card_id_by_draft_id)
    topic_id_by_draft_id = _promote_topics(db, draft)
    topic_ids = _promote_topic_links(db, draft, note_group, topic_id_by_draft_id, study_card_id_by_draft_id)
    graph_concept_ids: set[str] = set()
    concept_id_by_draft_node_id = _promote_knowledge_nodes(
        db,
        draft,
        note_group,
        topic_id_by_draft_id,
        graph_concept_ids,
    )
    _promote_study_card_knowledge_node_links(
        db,
        draft,
        note_group,
        study_card_id_by_draft_id,
        concept_id_by_draft_node_id,
        graph_concept_ids,
    )
    _promote_relations(db, draft, note_group, topic_id_by_draft_id, concept_id_by_draft_node_id, graph_concept_ids)

    existing_note_group_concept_ids = set(concept_id_by_draft_node_id.values())
    existing_note_group_concept_ids.update(
        row[0]
        for row in db.query(NoteGroupMindMapConcept.concept_id)
        .filter(NoteGroupMindMapConcept.note_group_id == note_group.id)
        .all()
    )
    for concept_id in sorted(graph_concept_ids - existing_note_group_concept_ids):
        db.add(
            NoteGroupMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group.id,
                concept_id=concept_id,
            )
        )

    embedding_count = _promote_embeddings(db, draft, live_cards_by_draft_id)
    db.flush()
    return {
        "study_card_count": len(study_card_id_by_draft_id),
        "question_card_count": question_count,
        "topic_count": len(topic_ids),
        "knowledge_node_count": len(concept_id_by_draft_node_id),
        "embedding_count": embedding_count,
    }
