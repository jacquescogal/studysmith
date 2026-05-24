import json
import math
import re
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import (
    MindMapConcept,
    MindMapRelation,
    NoteGroup,
    NoteGroupMindMapConcept,
    QuestionCard,
    StudyCard,
    StudyCardMindMapConcept,
    TopicChip,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.schemas import MindMapResponse

CONCEPT_TYPES = {"topic", "subtopic", "term", "process", "principle", "example"}
KNOWLEDGE_NODE_TYPES = {"definition", "mechanism", "rule", "fact"}
IMPORTANCE_LEVELS = {"core", "supporting", "detail"}
RELATION_TYPES = {
    "contains",
    "defines",
    "part_of",
    "requires",
    "enables",
    "causes",
    "contrasts_with",
    "example_of",
    "sequence",
    "related_to",
}
LINK_ROLES = {"primary", "supporting"}
MIN_RELATION_CONFIDENCE = 0.55


class MindMapValidationError(ValueError):
    pass


def slugify_concept_title(title: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", (title or "").strip().lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized or "concept"


def validate_candidate_graph(
    payload: dict,
    study_card_ids: set[str],
    existing_concept_ids: set[str],
    existing_topic_ids: set[str] | None = None,
) -> dict:
    if not isinstance(payload, dict):
        raise MindMapValidationError("Candidate graph payload must be an object.")

    if "topics" in payload or "knowledge_nodes" in payload:
        return _validate_topic_tree_candidate_graph(
            payload,
            study_card_ids,
            existing_concept_ids,
            existing_topic_ids or set(),
        )

    concepts = payload.get("concepts")
    relations = payload.get("relations")
    links = payload.get("links")
    if not isinstance(concepts, list):
        raise MindMapValidationError("Candidate graph concepts must be a list.")
    if not isinstance(relations, list):
        raise MindMapValidationError("Candidate graph relations must be a list.")
    if not isinstance(links, list):
        raise MindMapValidationError("Candidate graph links must be a list.")

    valid_refs = set(existing_concept_ids)
    temp_ids: set[str] = set()
    candidate_slugs: set[str] = set()
    normalized_concepts = []
    temp_to_canonical: dict[str, str] = {}

    for index, concept in enumerate(concepts):
        if not isinstance(concept, dict):
            raise MindMapValidationError(f"Concept at index {index} must be an object.")
        temp_id = _required_string(concept, "temp_id", f"Concept at index {index} is missing a temp_id.")
        if temp_id in temp_ids:
            raise MindMapValidationError(f"Duplicate concept temp_id: {temp_id}.")
        temp_ids.add(temp_id)

        title = _required_string(concept, "title", f"Concept {temp_id} is missing a title.")
        summary = _required_string(concept, "summary", f"Concept {temp_id} is missing a summary.")
        concept_type = _required_string(concept, "concept_type", f"Concept {temp_id} is missing a concept_type.")
        importance = _required_string(concept, "importance", f"Concept {temp_id} is missing an importance.")
        if concept_type not in CONCEPT_TYPES:
            raise MindMapValidationError(f"Invalid concept_type for concept {temp_id}: {concept_type}.")
        if importance not in IMPORTANCE_LEVELS:
            raise MindMapValidationError(f"Invalid importance for concept {temp_id}: {importance}.")

        matched_existing_concept_id = _optional_string_field(concept, "matched_existing_concept_id")
        if matched_existing_concept_id and matched_existing_concept_id not in existing_concept_ids:
            raise MindMapValidationError(f"Unknown matched_existing_concept_id: {matched_existing_concept_id}.")

        canonical_ref = matched_existing_concept_id or temp_id
        slug = slugify_concept_title(title)
        if slug in candidate_slugs:
            raise MindMapValidationError(f"Duplicate concept slug: {slug}.")
        candidate_slugs.add(slug)
        valid_refs.add(temp_id)
        temp_to_canonical[temp_id] = canonical_ref
        normalized_concepts.append(
            {
                "temp_id": temp_id,
                "matched_existing_concept_id": matched_existing_concept_id,
                "title": title,
                "summary": summary,
                "concept_type": concept_type,
                "importance": importance,
                "source_quote": _optional_string_field(concept, "source_quote"),
                "slug": slug,
            }
        )

    normalized_relations = []
    for index, relation in enumerate(relations):
        if not isinstance(relation, dict):
            raise MindMapValidationError(f"Relation at index {index} must be an object.")
        source_ref = _relation_ref(
            relation,
            ("source_concept_id", "source_temp_or_existing_id", "sourceConceptId"),
            "source_concept_id",
            index,
        )
        target_ref = _relation_ref(
            relation,
            ("target_concept_id", "target_temp_or_existing_id", "targetConceptId"),
            "target_concept_id",
            index,
        )
        if source_ref not in valid_refs:
            raise MindMapValidationError(f"Relation source does not resolve: {source_ref}.")
        if target_ref not in valid_refs:
            raise MindMapValidationError(f"Relation target does not resolve: {target_ref}.")
        if _canonical_ref(source_ref, temp_to_canonical) == _canonical_ref(target_ref, temp_to_canonical):
            raise MindMapValidationError("Self-relations are not allowed.")

        relation_type = _required_string(
            relation,
            "relation_type",
            f"Relation at index {index} is missing a relation_type.",
        )
        if relation_type not in RELATION_TYPES:
            raise MindMapValidationError(f"Invalid relation_type: {relation_type}.")
        confidence = _confidence_value(
            relation.get("confidence", 1.0),
            f"Relation at index {index} has invalid confidence.",
        )
        if confidence < MIN_RELATION_CONFIDENCE:
            continue

        normalized_relations.append(
            {
                "source_concept_id": source_ref,
                "target_concept_id": target_ref,
                "relation_type": relation_type,
                "label": _optional_string_field(relation, "label"),
                "confidence": confidence,
            }
        )

    normalized_links = []
    links_by_study_card_id: dict[str, list[dict]] = {study_card_id: [] for study_card_id in study_card_ids}
    seen_links: set[tuple[str, str]] = set()
    for index, link in enumerate(links):
        if not isinstance(link, dict):
            raise MindMapValidationError(f"Link at index {index} must be an object.")
        study_card_id = _required_string(link, "study_card_id", f"Link at index {index} is missing a study_card_id.")
        if study_card_id not in study_card_ids:
            raise MindMapValidationError(f"Link points to an unknown Study Card: {study_card_id}.")
        concept_ref = _required_string(link, "concept_id", f"Link at index {index} is missing a concept_id.")
        if concept_ref not in valid_refs:
            raise MindMapValidationError(f"Link concept does not resolve: {concept_ref}.")
        role = _optional_string_field(link, "role") or "supporting"
        if role not in LINK_ROLES:
            raise MindMapValidationError(f"Invalid link role: {role}.")

        dedupe_key = (study_card_id, _canonical_ref(concept_ref, temp_to_canonical))
        if dedupe_key in seen_links:
            continue
        seen_links.add(dedupe_key)

        normalized_link = {
            "study_card_id": study_card_id,
            "concept_id": concept_ref,
            "role": role,
        }
        normalized_links.append(normalized_link)
        links_by_study_card_id[study_card_id].append(normalized_link)

    missing_link_ids = sorted(
        study_card_id for study_card_id, card_links in links_by_study_card_id.items() if not card_links
    )
    if missing_link_ids:
        raise MindMapValidationError(f"Every Study Card must have at least one concept link: {', '.join(missing_link_ids)}.")

    for card_links in links_by_study_card_id.values():
        if not any(link["role"] == "primary" for link in card_links):
            card_links[0]["role"] = "primary"

    return {
        "concepts": normalized_concepts,
        "relations": normalized_relations,
        "links": normalized_links,
    }


def _validate_topic_tree_candidate_graph(
    payload: dict,
    study_card_ids: set[str],
    existing_knowledge_node_ids: set[str],
    existing_topic_ids: set[str],
) -> dict:
    topics = payload.get("topics")
    knowledge_nodes = payload.get("knowledge_nodes")
    relations = payload.get("relations")
    study_card_topic_links = payload.get("study_card_topic_links")
    study_card_knowledge_node_links = payload.get("study_card_knowledge_node_links", [])
    if not isinstance(topics, list):
        raise MindMapValidationError("Candidate graph topics must be a list.")
    if not isinstance(knowledge_nodes, list):
        raise MindMapValidationError("Candidate graph knowledge_nodes must be a list.")
    if not isinstance(relations, list):
        raise MindMapValidationError("Candidate graph relations must be a list.")
    if not isinstance(study_card_topic_links, list):
        raise MindMapValidationError("Candidate graph study_card_topic_links must be a list.")
    if not isinstance(study_card_knowledge_node_links, list):
        raise MindMapValidationError("Candidate graph study_card_knowledge_node_links must be a list.")

    topic_temp_ids: set[str] = set()
    topic_slugs: set[str] = set()
    valid_topic_refs = set(existing_topic_ids)
    topic_temp_to_canonical: dict[str, str] = {}
    normalized_topics = []
    for index, topic in enumerate(topics):
        if not isinstance(topic, dict):
            raise MindMapValidationError(f"Topic at index {index} must be an object.")
        temp_id = _required_string(topic, "temp_id", f"Topic at index {index} is missing a temp_id.")
        if temp_id in topic_temp_ids:
            raise MindMapValidationError(f"Duplicate topic temp_id: {temp_id}.")
        topic_temp_ids.add(temp_id)

        title = _required_string(topic, "title", f"Topic {temp_id} is missing a title.")
        summary = _required_string(topic, "summary", f"Topic {temp_id} is missing a summary.")
        matched_existing_topic_id = _optional_string_field(topic, "matched_existing_topic_id")
        if matched_existing_topic_id and matched_existing_topic_id not in existing_topic_ids:
            raise MindMapValidationError(f"Unknown matched_existing_topic_id: {matched_existing_topic_id}.")

        slug = slugify_concept_title(title)
        if slug in topic_slugs:
            raise MindMapValidationError(f"Duplicate topic slug: {slug}.")
        topic_slugs.add(slug)
        canonical_ref = matched_existing_topic_id or temp_id
        valid_topic_refs.add(temp_id)
        topic_temp_to_canonical[temp_id] = canonical_ref
        normalized_topics.append(
            {
                "temp_id": temp_id,
                "matched_existing_topic_id": matched_existing_topic_id,
                "parent_topic_id": _optional_string_field(topic, "parent_topic_id"),
                "title": title,
                "summary": summary,
                "slug": slug,
            }
        )

    for topic in normalized_topics:
        parent_topic_id = topic["parent_topic_id"]
        if not parent_topic_id:
            continue
        if parent_topic_id not in valid_topic_refs:
            raise MindMapValidationError(f"Topic parent does not resolve: {parent_topic_id}.")
        if _canonical_ref(parent_topic_id, topic_temp_to_canonical) == _canonical_ref(
            topic["temp_id"],
            topic_temp_to_canonical,
        ):
            raise MindMapValidationError("Topic cannot be its own parent.")

    knowledge_node_temp_ids: set[str] = set()
    knowledge_node_slugs: set[str] = set()
    valid_knowledge_node_refs = set(existing_knowledge_node_ids)
    knowledge_node_temp_to_canonical: dict[str, str] = {}
    normalized_knowledge_nodes = []
    for index, node in enumerate(knowledge_nodes):
        if not isinstance(node, dict):
            raise MindMapValidationError(f"Knowledge Node at index {index} must be an object.")
        temp_id = _required_string(node, "temp_id", f"Knowledge Node at index {index} is missing a temp_id.")
        if temp_id in knowledge_node_temp_ids:
            raise MindMapValidationError(f"Duplicate knowledge node temp_id: {temp_id}.")
        knowledge_node_temp_ids.add(temp_id)

        topic_ref = _candidate_ref(
            node,
            ("topic_id", "topic_temp_or_existing_id", "parent_topic_id"),
            f"Knowledge Node {temp_id} is missing a topic_id.",
        )
        if topic_ref not in valid_topic_refs:
            raise MindMapValidationError(f"Knowledge Node topic does not resolve: {topic_ref}.")
        title = _required_string(node, "title", f"Knowledge Node {temp_id} is missing a title.")
        summary = _required_string(node, "summary", f"Knowledge Node {temp_id} is missing a summary.")
        knowledge_type = _required_string(
            node,
            "knowledge_type",
            f"Knowledge Node {temp_id} is missing a knowledge_type.",
        )
        importance = _required_string(node, "importance", f"Knowledge Node {temp_id} is missing an importance.")
        if knowledge_type not in KNOWLEDGE_NODE_TYPES:
            raise MindMapValidationError(f"Invalid knowledge_type for Knowledge Node {temp_id}: {knowledge_type}.")
        if importance not in IMPORTANCE_LEVELS:
            raise MindMapValidationError(f"Invalid importance for Knowledge Node {temp_id}: {importance}.")

        matched_existing_knowledge_node_id = _optional_string_field(node, "matched_existing_knowledge_node_id")
        if matched_existing_knowledge_node_id and matched_existing_knowledge_node_id not in existing_knowledge_node_ids:
            raise MindMapValidationError(
                f"Unknown matched_existing_knowledge_node_id: {matched_existing_knowledge_node_id}."
            )
        slug = slugify_concept_title(title)
        if slug in knowledge_node_slugs:
            raise MindMapValidationError(f"Duplicate knowledge node slug: {slug}.")
        knowledge_node_slugs.add(slug)
        canonical_ref = matched_existing_knowledge_node_id or temp_id
        valid_knowledge_node_refs.add(temp_id)
        knowledge_node_temp_to_canonical[temp_id] = canonical_ref
        normalized_knowledge_nodes.append(
            {
                "temp_id": temp_id,
                "matched_existing_knowledge_node_id": matched_existing_knowledge_node_id,
                "topic_id": topic_ref,
                "title": title,
                "summary": summary,
                "knowledge_type": knowledge_type,
                "importance": importance,
                "source_quote": _optional_string_field(node, "source_quote"),
                "slug": slug,
            }
        )

    normalized_topic_links = _validate_study_card_links(
        study_card_topic_links,
        study_card_ids,
        valid_topic_refs,
        topic_temp_to_canonical,
        "topic_id",
        "Topic",
    )
    normalized_knowledge_node_links = _validate_study_card_links(
        study_card_knowledge_node_links,
        study_card_ids,
        valid_knowledge_node_refs,
        knowledge_node_temp_to_canonical,
        "knowledge_node_id",
        "Knowledge Node",
        require_every_card=False,
    )

    return {
        "topics": normalized_topics,
        "knowledge_nodes": normalized_knowledge_nodes,
        "relations": relations,
        "study_card_topic_links": normalized_topic_links,
        "study_card_knowledge_node_links": normalized_knowledge_node_links,
    }


def regenerate_note_group_mind_map(db: Session, note_group_id: str, candidate_payload: dict) -> None:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise MindMapValidationError(f"Note Group not found: {note_group_id}.")

    study_cards = (
        db.query(StudyCard)
        .filter(StudyCard.note_group_id == note_group_id)
        .order_by(StudyCard.created_at.asc(), StudyCard.id.asc())
        .all()
    )
    if not study_cards:
        raise MindMapValidationError("Cannot generate a Concept Mind Map for a Note Group without Study Cards.")

    study_card_ids = {card.id for card in study_cards}
    existing_concepts = db.query(MindMapConcept).filter(MindMapConcept.module_id == note_group.module_id).all()
    existing_concept_ids = {concept.id for concept in existing_concepts}
    concepts_by_id = {concept.id: concept for concept in existing_concepts}
    concepts_by_slug = {concept.slug: concept for concept in existing_concepts}
    if "topics" in candidate_payload or "knowledge_nodes" in candidate_payload:
        _regenerate_note_group_topic_tree_mind_map(
            db,
            note_group,
            study_card_ids,
            existing_concepts,
            existing_concept_ids,
            candidate_payload,
        )
        return

    validated = validate_candidate_graph(candidate_payload, study_card_ids, existing_concept_ids)

    db.query(NoteGroupMindMapConcept).filter(NoteGroupMindMapConcept.note_group_id == note_group_id).delete(
        synchronize_session=False
    )
    db.query(StudyCardMindMapConcept).filter(StudyCardMindMapConcept.study_card_id.in_(study_card_ids)).delete(
        synchronize_session=False
    )
    db.query(MindMapRelation).filter(MindMapRelation.source_note_group_id == note_group_id).delete(
        synchronize_session=False
    )
    db.flush()

    resolved_concepts: dict[str, MindMapConcept] = {concept.id: concept for concept in existing_concepts}
    graph_concept_ids: set[str] = set()
    for concept_data in validated["concepts"]:
        concept = None
        matched_existing_concept_id = concept_data["matched_existing_concept_id"]
        if matched_existing_concept_id:
            concept = concepts_by_id[matched_existing_concept_id]
        if concept is None:
            concept = concepts_by_slug.get(concept_data["slug"])
        if concept is None:
            concept = MindMapConcept(
                id=str(uuid.uuid4()),
                module_id=note_group.module_id,
                slug=_unique_slug(concepts_by_slug, concept_data["slug"]),
                title=concept_data["title"],
                summary=concept_data["summary"],
                concept_type=concept_data["concept_type"],
                importance=concept_data["importance"],
                source_quote=concept_data["source_quote"],
            )
            db.add(concept)
            concepts_by_id[concept.id] = concept
            concepts_by_slug[concept.slug] = concept
        resolved_concepts[concept_data["temp_id"]] = concept
        resolved_concepts[concept.id] = concept
        graph_concept_ids.add(concept.id)

    db.flush()

    final_links: dict[tuple[str, str], dict[str, str]] = {}
    final_links_by_study_card_id: dict[str, list[dict[str, str]]] = {
        study_card_id: [] for study_card_id in study_card_ids
    }
    for link in validated["links"]:
        concept = resolved_concepts[link["concept_id"]]
        graph_concept_ids.add(concept.id)
        dedupe_key = (link["study_card_id"], concept.id)
        final_link = final_links.get(dedupe_key)
        if final_link is None:
            final_link = {
                "study_card_id": link["study_card_id"],
                "concept_id": concept.id,
                "role": link["role"],
            }
            final_links[dedupe_key] = final_link
            final_links_by_study_card_id[link["study_card_id"]].append(final_link)
        elif link["role"] == "primary":
            final_link["role"] = "primary"

    for card_links in final_links_by_study_card_id.values():
        if card_links and not any(link["role"] == "primary" for link in card_links):
            card_links[0]["role"] = "primary"

    for link in final_links.values():
        db.add(
            StudyCardMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group_id,
                study_card_id=link["study_card_id"],
                concept_id=link["concept_id"],
                role=link["role"],
            )
        )

    seen_relations: set[tuple[str, str, str]] = set()
    for relation in validated["relations"]:
        source_concept = resolved_concepts[relation["source_concept_id"]]
        target_concept = resolved_concepts[relation["target_concept_id"]]
        if source_concept.id == target_concept.id:
            continue
        dedupe_key = (source_concept.id, target_concept.id, relation["relation_type"])
        if dedupe_key in seen_relations:
            continue
        seen_relations.add(dedupe_key)
        graph_concept_ids.add(source_concept.id)
        graph_concept_ids.add(target_concept.id)
        db.add(
            MindMapRelation(
                id=str(uuid.uuid4()),
                module_id=note_group.module_id,
                source_concept_id=source_concept.id,
                target_concept_id=target_concept.id,
                relation_type=relation["relation_type"],
                label=relation["label"],
                confidence=relation["confidence"],
                source_note_group_id=note_group_id,
            )
        )

    for concept_id in sorted(graph_concept_ids):
        db.add(
            NoteGroupMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group_id,
                concept_id=concept_id,
            )
        )

    note_group.mind_map_status = "complete"
    note_group.mind_map_stale = False
    note_group.mind_map_generated_at = datetime.utcnow()
    db.flush()
    _prune_orphan_module_concepts(db, note_group.module_id)
    db.flush()


def _regenerate_note_group_topic_tree_mind_map(
    db: Session,
    note_group: NoteGroup,
    study_card_ids: set[str],
    existing_concepts: list[MindMapConcept],
    existing_concept_ids: set[str],
    candidate_payload: dict,
) -> None:
    existing_topics = db.query(TopicChip).filter(TopicChip.module_id == note_group.module_id).all()
    existing_topic_ids = {topic.id for topic in existing_topics}
    topics_by_id = {topic.id: topic for topic in existing_topics}
    topics_by_slug = {slugify_concept_title(topic.label): topic for topic in existing_topics}
    concepts_by_id = {concept.id: concept for concept in existing_concepts}
    concepts_by_slug = {concept.slug: concept for concept in existing_concepts}
    validated = validate_candidate_graph(
        candidate_payload,
        study_card_ids,
        existing_concept_ids,
        existing_topic_ids,
    )

    db.query(NoteGroupMindMapConcept).filter(NoteGroupMindMapConcept.note_group_id == note_group.id).delete(
        synchronize_session=False
    )
    db.query(StudyCardMindMapConcept).filter(StudyCardMindMapConcept.study_card_id.in_(study_card_ids)).delete(
        synchronize_session=False
    )
    db.query(MindMapRelation).filter(MindMapRelation.source_note_group_id == note_group.id).delete(
        synchronize_session=False
    )
    db.execute(study_card_topic_chips.delete().where(study_card_topic_chips.c.study_card_id.in_(study_card_ids)))
    db.execute(note_group_topic_chips.delete().where(note_group_topic_chips.c.note_group_id == note_group.id))
    db.flush()

    resolved_topics: dict[str, TopicChip] = {topic.id: topic for topic in existing_topics}
    for topic_data in validated["topics"]:
        topic = None
        matched_existing_topic_id = topic_data["matched_existing_topic_id"]
        if matched_existing_topic_id:
            topic = topics_by_id[matched_existing_topic_id]
        if topic is None:
            topic = topics_by_slug.get(topic_data["slug"])
        if topic is None:
            topic = TopicChip(
                id=str(uuid.uuid4()),
                module_id=note_group.module_id,
                label=topic_data["title"],
                description=topic_data["summary"],
            )
            db.add(topic)
            topics_by_id[topic.id] = topic
            topics_by_slug[topic_data["slug"]] = topic
        else:
            topic.label = topic_data["title"]
            if not topic.description:
                topic.description = topic_data["summary"]
        resolved_topics[topic_data["temp_id"]] = topic
        resolved_topics[topic.id] = topic

    db.flush()

    for topic_data in validated["topics"]:
        topic = resolved_topics[topic_data["temp_id"]]
        parent_ref = topic_data["parent_topic_id"]
        topic.parent_topic_id = resolved_topics[parent_ref].id if parent_ref else None

    resolved_concepts: dict[str, MindMapConcept] = {concept.id: concept for concept in existing_concepts}
    graph_concept_ids: set[str] = set()
    for node_data in validated["knowledge_nodes"]:
        concept = None
        matched_existing_node_id = node_data["matched_existing_knowledge_node_id"]
        if matched_existing_node_id:
            concept = concepts_by_id[matched_existing_node_id]
        if concept is None:
            concept = concepts_by_slug.get(node_data["slug"])
        topic = resolved_topics[node_data["topic_id"]]
        if concept is None:
            concept = MindMapConcept(
                id=str(uuid.uuid4()),
                module_id=note_group.module_id,
                topic_id=topic.id,
                slug=_unique_slug(concepts_by_slug, node_data["slug"]),
                title=node_data["title"],
                summary=node_data["summary"],
                concept_type=_legacy_concept_type_for_knowledge_type(node_data["knowledge_type"]),
                knowledge_type=node_data["knowledge_type"],
                importance=node_data["importance"],
                source_quote=node_data["source_quote"],
            )
            db.add(concept)
            concepts_by_id[concept.id] = concept
            concepts_by_slug[concept.slug] = concept
        else:
            concept.topic_id = topic.id
            concept.title = node_data["title"]
            concept.summary = node_data["summary"]
            concept.concept_type = _legacy_concept_type_for_knowledge_type(node_data["knowledge_type"])
            concept.knowledge_type = node_data["knowledge_type"]
            concept.importance = node_data["importance"]
            concept.source_quote = node_data["source_quote"]
        resolved_concepts[node_data["temp_id"]] = concept
        resolved_concepts[concept.id] = concept
        graph_concept_ids.add(concept.id)

    db.flush()

    topic_ids_for_note_group: set[str] = set()
    seen_study_card_topic_links: set[tuple[str, str]] = set()
    for link in validated["study_card_topic_links"]:
        topic = resolved_topics[link["topic_id"]]
        topic_ids_for_note_group.add(topic.id)
        link_key = (link["study_card_id"], topic.id)
        if link_key in seen_study_card_topic_links:
            continue
        seen_study_card_topic_links.add(link_key)
        db.execute(
            study_card_topic_chips.insert().values(
                study_card_id=link["study_card_id"],
                chip_id=topic.id,
            )
        )

    for topic_data in validated["topics"]:
        topic_ids_for_note_group.add(resolved_topics[topic_data["temp_id"]].id)

    for topic_id in sorted(topic_ids_for_note_group):
        db.execute(
            note_group_topic_chips.insert().values(
                note_group_id=note_group.id,
                chip_id=topic_id,
            )
        )

    seen_concept_links: set[tuple[str, str]] = set()
    for link in validated["study_card_knowledge_node_links"]:
        concept = resolved_concepts[link["knowledge_node_id"]]
        graph_concept_ids.add(concept.id)
        link_key = (link["study_card_id"], concept.id)
        if link_key in seen_concept_links:
            continue
        seen_concept_links.add(link_key)
        db.add(
            StudyCardMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group.id,
                study_card_id=link["study_card_id"],
                concept_id=concept.id,
                role=link["role"],
            )
        )

    for concept_id in sorted(graph_concept_ids):
        db.add(
            NoteGroupMindMapConcept(
                module_id=note_group.module_id,
                note_group_id=note_group.id,
                concept_id=concept_id,
            )
        )

    note_group.mind_map_status = "complete"
    note_group.mind_map_stale = False
    note_group.mind_map_generated_at = datetime.utcnow()
    db.flush()
    _prune_orphan_module_concepts(db, note_group.module_id)
    db.flush()


def mark_note_group_mind_map_stale(db: Session, note_group_id: str) -> None:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise MindMapValidationError(f"Note Group not found: {note_group_id}.")
    if note_group.mind_map_status == "not_generated":
        return
    note_group.mind_map_stale = True
    db.flush()


def reset_note_group_mind_map(db: Session, note_group_id: str) -> None:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise MindMapValidationError(f"Note Group not found: {note_group_id}.")
    study_card_ids = {
        row[0]
        for row in db.query(StudyCard.id)
        .filter(StudyCard.note_group_id == note_group_id)
        .all()
    }
    db.query(NoteGroupMindMapConcept).filter(NoteGroupMindMapConcept.note_group_id == note_group_id).delete(
        synchronize_session=False
    )
    if study_card_ids:
        db.query(StudyCardMindMapConcept).filter(StudyCardMindMapConcept.study_card_id.in_(study_card_ids)).delete(
            synchronize_session=False
        )
    db.query(MindMapRelation).filter(MindMapRelation.source_note_group_id == note_group_id).delete(
        synchronize_session=False
    )
    note_group.mind_map_status = "not_generated"
    note_group.mind_map_stale = False
    note_group.mind_map_generated_at = None
    db.flush()
    _prune_orphan_module_concepts(db, note_group.module_id)
    db.flush()


def build_note_group_mind_map_response(db: Session, note_group_id: str) -> MindMapResponse:
    note_group = db.get(NoteGroup, note_group_id)
    if not note_group:
        raise MindMapValidationError(f"Note Group not found: {note_group_id}.")
    concept_ids = {
        row[0]
        for row in db.query(NoteGroupMindMapConcept.concept_id)
        .filter(NoteGroupMindMapConcept.note_group_id == note_group_id)
        .all()
    }
    return _build_mind_map_response(
        db=db,
        scope="note_group",
        module_id=note_group.module_id,
        note_groups=[note_group],
        concept_ids=concept_ids,
        status=note_group.mind_map_status,
        stale=bool(note_group.mind_map_stale),
        generated_at=note_group.mind_map_generated_at,
    )


def build_module_mind_map_response(db: Session, module_id: str) -> MindMapResponse:
    note_groups = (
        db.query(NoteGroup)
        .filter(NoteGroup.module_id == module_id)
        .order_by(NoteGroup.sort_order.asc(), NoteGroup.created_at.asc(), NoteGroup.id.asc())
        .all()
    )
    concept_ids = {
        row[0]
        for row in db.query(NoteGroupMindMapConcept.concept_id)
        .filter(NoteGroupMindMapConcept.module_id == module_id)
        .all()
    }
    stale = any(bool(note_group.mind_map_stale) for note_group in note_groups)
    generated_times = [note_group.mind_map_generated_at for note_group in note_groups if note_group.mind_map_generated_at]
    status = _module_mind_map_status(note_groups, bool(concept_ids))
    return _build_mind_map_response(
        db=db,
        scope="module",
        module_id=module_id,
        note_groups=note_groups,
        concept_ids=concept_ids,
        status=status,
        stale=stale,
        generated_at=max(generated_times) if generated_times else None,
    )


def _build_mind_map_response(
    db: Session,
    scope: str,
    module_id: str,
    note_groups: list[NoteGroup],
    concept_ids: set[str],
    status: str,
    stale: bool,
    generated_at: datetime | None,
) -> MindMapResponse:
    note_group_ids = {note_group.id for note_group in note_groups}
    concepts = []
    if concept_ids:
        concepts = (
            db.query(MindMapConcept)
            .filter(MindMapConcept.module_id == module_id, MindMapConcept.id.in_(concept_ids))
            .order_by(MindMapConcept.importance.asc(), MindMapConcept.title.asc(), MindMapConcept.id.asc())
            .all()
        )

    study_card_links = []
    if concept_ids:
        study_card_links = (
            db.query(StudyCardMindMapConcept)
            .filter(
                StudyCardMindMapConcept.module_id == module_id,
                StudyCardMindMapConcept.concept_id.in_(concept_ids),
            )
            .all()
        )
        if note_group_ids:
            study_card_links = [link for link in study_card_links if link.note_group_id in note_group_ids]

    study_card_ids = {link.study_card_id for link in study_card_links}
    study_cards = []
    if study_card_ids:
        study_cards = (
            db.query(StudyCard)
            .filter(StudyCard.id.in_(study_card_ids))
            .order_by(StudyCard.created_at.asc(), StudyCard.id.asc())
            .all()
        )

    topic_ids_by_study_card_id = _topic_ids_by_study_card_id(db, study_card_ids)
    study_card_ids_by_concept_id: dict[str, set[str]] = {concept_id: set() for concept_id in concept_ids}
    note_group_ids_by_concept_id: dict[str, set[str]] = {concept_id: set() for concept_id in concept_ids}
    topic_ids_by_concept_id: dict[str, set[str]] = {concept_id: set() for concept_id in concept_ids}
    for link in study_card_links:
        study_card_ids_by_concept_id.setdefault(link.concept_id, set()).add(link.study_card_id)
        note_group_ids_by_concept_id.setdefault(link.concept_id, set()).add(link.note_group_id)
        topic_ids_by_concept_id.setdefault(link.concept_id, set()).update(
            topic_ids_by_study_card_id.get(link.study_card_id, set())
        )

    concept_note_group_rows = []
    if concept_ids:
        concept_note_group_rows = (
            db.query(NoteGroupMindMapConcept.concept_id, NoteGroupMindMapConcept.note_group_id)
            .filter(
                NoteGroupMindMapConcept.module_id == module_id,
                NoteGroupMindMapConcept.concept_id.in_(concept_ids),
            )
            .all()
        )
    for concept_id, linked_note_group_id in concept_note_group_rows:
        if not note_group_ids or linked_note_group_id in note_group_ids:
            note_group_ids_by_concept_id.setdefault(concept_id, set()).add(linked_note_group_id)

    edges = []
    if concept_ids:
        relations = (
            db.query(MindMapRelation)
            .filter(
                MindMapRelation.module_id == module_id,
                MindMapRelation.source_concept_id.in_(concept_ids),
                MindMapRelation.target_concept_id.in_(concept_ids),
            )
            .order_by(MindMapRelation.created_at.asc(), MindMapRelation.id.asc())
            .all()
        )
        if note_group_ids:
            relations = [relation for relation in relations if relation.source_note_group_id in note_group_ids]
        edges = [
            {
                "id": relation.id,
                "source": relation.source_concept_id,
                "target": relation.target_concept_id,
                "relation_type": relation.relation_type,
                "label": relation.label,
                "confidence": relation.confidence,
                "source_note_group_id": relation.source_note_group_id,
            }
            for relation in relations
        ]

    question_cards = _question_cards_for_study_cards(db, note_group_ids, study_card_ids)
    note_group_id = note_groups[0].id if scope == "note_group" and note_groups else None
    return MindMapResponse(
        scope=scope,
        module_id=module_id,
        note_group_id=note_group_id,
        status=status,
        stale=stale,
        generated_at=generated_at,
        nodes=[
            {
                "id": concept.id,
                "node_type": "concept",
                "title": concept.title,
                "summary": concept.summary,
                "concept_type": concept.concept_type,
                "importance": concept.importance,
                "topic_ids": sorted(topic_ids_by_concept_id.get(concept.id, set())),
                "study_card_ids": sorted(study_card_ids_by_concept_id.get(concept.id, set())),
                "note_group_ids": sorted(note_group_ids_by_concept_id.get(concept.id, set())),
                "study_card_count": len(study_card_ids_by_concept_id.get(concept.id, set())),
                "note_group_count": len(note_group_ids_by_concept_id.get(concept.id, set())),
            }
            for concept in concepts
        ],
        edges=edges,
        study_cards=[
            {
                "id": study_card.id,
                "note_group_id": study_card.note_group_id,
                "title": study_card.title,
                "content": study_card.content,
            }
            for study_card in study_cards
        ],
        question_cards=question_cards,
        note_groups=[{"id": note_group.id, "title": note_group.title} for note_group in note_groups],
    )


def _required_string(payload: dict[str, Any], key: str, message: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise MindMapValidationError(message)
    return value.strip()


def _optional_string_field(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise MindMapValidationError(f"{key} must be a string.")
    stripped = value.strip()
    return stripped or None


def _relation_ref(relation: dict[str, Any], allowed_keys: tuple[str, ...], display_key: str, index: int) -> str:
    value = None
    for key in allowed_keys:
        if key in relation:
            value = relation[key]
            break
    if not isinstance(value, str) or not value.strip():
        raise MindMapValidationError(f"Relation at index {index} is missing {display_key}.")
    return value.strip()


def _candidate_ref(payload: dict[str, Any], allowed_keys: tuple[str, ...], message: str) -> str:
    value = None
    for key in allowed_keys:
        if key in payload:
            value = payload[key]
            break
    if not isinstance(value, str) or not value.strip():
        raise MindMapValidationError(message)
    return value.strip()


def _validate_study_card_links(
    links: list,
    study_card_ids: set[str],
    valid_refs: set[str],
    temp_to_canonical: dict[str, str],
    ref_key: str,
    ref_label: str,
    require_every_card: bool = True,
) -> list[dict[str, str]]:
    normalized_links = []
    links_by_study_card_id: dict[str, list[dict]] = {study_card_id: [] for study_card_id in study_card_ids}
    seen_links: set[tuple[str, str]] = set()
    for index, link in enumerate(links):
        if not isinstance(link, dict):
            raise MindMapValidationError(f"{ref_label} link at index {index} must be an object.")
        study_card_id = _required_string(
            link,
            "study_card_id",
            f"{ref_label} link at index {index} is missing a study_card_id.",
        )
        if study_card_id not in study_card_ids:
            raise MindMapValidationError(f"{ref_label} link points to an unknown Study Card: {study_card_id}.")
        ref = _required_string(link, ref_key, f"{ref_label} link at index {index} is missing a {ref_key}.")
        if ref not in valid_refs:
            raise MindMapValidationError(f"{ref_label} link does not resolve: {ref}.")
        role = _optional_string_field(link, "role") or "supporting"
        if role not in LINK_ROLES:
            raise MindMapValidationError(f"Invalid {ref_label} link role: {role}.")

        dedupe_key = (study_card_id, _canonical_ref(ref, temp_to_canonical))
        if dedupe_key in seen_links:
            continue
        seen_links.add(dedupe_key)

        normalized_link = {
            "study_card_id": study_card_id,
            ref_key: ref,
            "role": role,
        }
        normalized_links.append(normalized_link)
        links_by_study_card_id[study_card_id].append(normalized_link)

    missing_link_ids = sorted(
        study_card_id for study_card_id, card_links in links_by_study_card_id.items() if not card_links
    )
    if require_every_card and missing_link_ids:
        raise MindMapValidationError(
            f"Every Study Card must have at least one {ref_label} link: {', '.join(missing_link_ids)}."
        )

    for card_links in links_by_study_card_id.values():
        if card_links and not any(link["role"] == "primary" for link in card_links):
            card_links[0]["role"] = "primary"

    return normalized_links


def _confidence_value(value: Any, message: str) -> float:
    if isinstance(value, bool):
        raise MindMapValidationError(message)
    try:
        confidence = float(value)
    except (TypeError, ValueError) as exc:
        raise MindMapValidationError(message) from exc
    if not math.isfinite(confidence) or confidence < 0 or confidence > 1:
        raise MindMapValidationError(message)
    return confidence


def _module_mind_map_status(note_groups: list[NoteGroup], has_graph_nodes: bool) -> str:
    if has_graph_nodes or any(note_group.mind_map_status == "complete" for note_group in note_groups):
        return "complete"
    for status in ("generating", "queued", "failed"):
        if any(note_group.mind_map_status == status for note_group in note_groups):
            return status
    return "not_generated"


def _canonical_ref(ref: str, temp_to_canonical: dict[str, str]) -> str:
    return temp_to_canonical.get(ref, ref)


def _unique_slug(concepts_by_slug: dict[str, MindMapConcept], slug: str) -> str:
    if slug not in concepts_by_slug:
        return slug
    suffix = 2
    while f"{slug}_{suffix}" in concepts_by_slug:
        suffix += 1
    return f"{slug}_{suffix}"


def _legacy_concept_type_for_knowledge_type(knowledge_type: str) -> str:
    return {
        "definition": "term",
        "mechanism": "process",
        "rule": "principle",
        "fact": "example",
    }.get(knowledge_type, "term")


def _prune_orphan_module_concepts(db: Session, module_id: str) -> None:
    concepts = db.query(MindMapConcept).filter(MindMapConcept.module_id == module_id).all()
    for concept in concepts:
        has_note_group_link = (
            db.query(NoteGroupMindMapConcept)
            .filter(NoteGroupMindMapConcept.module_id == module_id, NoteGroupMindMapConcept.concept_id == concept.id)
            .first()
            is not None
        )
        has_study_card_link = (
            db.query(StudyCardMindMapConcept)
            .filter(StudyCardMindMapConcept.module_id == module_id, StudyCardMindMapConcept.concept_id == concept.id)
            .first()
            is not None
        )
        has_relation = (
            db.query(MindMapRelation)
            .filter(
                MindMapRelation.module_id == module_id,
                or_(
                    MindMapRelation.source_concept_id == concept.id,
                    MindMapRelation.target_concept_id == concept.id,
                ),
            )
            .first()
            is not None
        )
        if not has_note_group_link and not has_study_card_link and not has_relation:
            db.delete(concept)


def _topic_ids_by_study_card_id(db: Session, study_card_ids: set[str]) -> dict[str, set[str]]:
    if not study_card_ids:
        return {}
    rows = db.execute(
        study_card_topic_chips.select()
        .where(study_card_topic_chips.c.study_card_id.in_(study_card_ids))
        .order_by(study_card_topic_chips.c.study_card_id.asc(), study_card_topic_chips.c.chip_id.asc())
    ).all()
    topic_ids_by_study_card_id: dict[str, set[str]] = {}
    for row in rows:
        topic_ids_by_study_card_id.setdefault(row.study_card_id, set()).add(row.chip_id)
    return topic_ids_by_study_card_id


def _question_cards_for_study_cards(
    db: Session,
    note_group_ids: set[str],
    study_card_ids: set[str],
) -> list[dict]:
    if not note_group_ids or not study_card_ids:
        return []
    cards = (
        db.query(QuestionCard)
        .filter(QuestionCard.note_group_id.in_(note_group_ids))
        .order_by(QuestionCard.created_at.asc(), QuestionCard.id.asc())
        .all()
    )
    response = []
    for card in cards:
        refs = _study_card_refs(card.study_card_refs_json)
        if any(ref in study_card_ids for ref in refs):
            response.append(
                {
                    "id": card.id,
                    "note_group_id": card.note_group_id,
                    "prompt": card.prompt,
                    "study_card_refs": refs,
                }
            )
    return response


def _study_card_refs(value: str | None) -> list[str]:
    try:
        refs = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(refs, list):
        return []
    return [ref for ref in refs if isinstance(ref, str)]
