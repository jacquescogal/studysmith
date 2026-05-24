import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.jobs import JOB_TYPE_MIND_MAP_GENERATION, run_mind_map_generation
from app.mind_map import (
    MindMapValidationError,
    build_module_mind_map_response,
    build_note_group_mind_map_response,
    regenerate_note_group_mind_map,
    slugify_concept_title,
    validate_candidate_graph,
)
from app.openai_client import generate_mind_map_candidate_graph
from app.models import (
    MindMapConcept,
    MindMapRelation,
    Module,
    NoteGroup,
    NoteGroupMindMapConcept,
    Job,
    QuestionCard,
    StudyCard,
    StudyCardMindMapConcept,
    Subject,
    SubjectAccess,
    SUBJECT_ACCESS_MAINTAINER,
    SUBJECT_ACCESS_READER,
    SUBJECT_VISIBILITY_PUBLIC,
    TopicChip,
    User,
    study_card_topic_chips,
)
from app.schemas import MindMapResponse


class MindMapModelTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def _owner(self) -> User:
        return User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")

    def test_note_group_has_mind_map_status_defaults(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Note Group",
                source="source",
                raw_text="raw",
            )
            db.add_all([owner, subject, module, note_group])
            db.commit()

            stored = db.get(NoteGroup, "note-group-1")

            self.assertEqual(stored.mind_map_status, "not_generated")
            self.assertFalse(stored.mind_map_stale)
            self.assertIsNone(stored.mind_map_generated_at)
        finally:
            db.close()


class MindMapServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def _owner(self) -> User:
        return User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")

    def seed_graph_scope(self, db):
        owner = User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
        module = Module(id="module-1", subject_id="subject-1", title="Module")
        note_group = NoteGroup(id="note-a", module_id="module-1", title="Note A", raw_text="target")
        topic = TopicChip(id="topic-a", module_id="module-1", label="Security")
        study_card = StudyCard(
            id="card-a",
            note_group_id="note-a",
            title="RLS",
            content="Row-level security content",
        )
        db.add_all([owner, subject, module, note_group, topic, study_card])
        db.commit()
        db.execute(study_card_topic_chips.insert().values(study_card_id="card-a", chip_id="topic-a"))
        db.commit()

    def _seed_mind_map_workspace(self, db):
        owner = User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
        module = Module(id="module-1", subject_id="subject-1", title="Module")
        target_group = NoteGroup(id="note-group-1", module_id="module-1", title="Target", raw_text="target")
        other_group = NoteGroup(id="note-group-2", module_id="module-1", title="Other", raw_text="other")
        target_card_1 = StudyCard(
            id="study-card-1",
            note_group_id="note-group-1",
            title="RLS",
            content="Row-level security content",
        )
        target_card_2 = StudyCard(
            id="study-card-2",
            note_group_id="note-group-1",
            title="Policies",
            content="Policy content",
        )
        other_card = StudyCard(
            id="study-card-other",
            note_group_id="note-group-2",
            title="Other",
            content="Other content",
        )
        existing_concept = MindMapConcept(
            id="concept-existing",
            module_id="module-1",
            slug="existing_security",
            title="Existing Security",
            summary="Existing security summary.",
            concept_type="topic",
            importance="core",
        )
        old_target_concept = MindMapConcept(
            id="concept-old-target",
            module_id="module-1",
            slug="old_target",
            title="Old Target",
            summary="Old target summary.",
            concept_type="term",
            importance="detail",
        )
        other_concept = MindMapConcept(
            id="concept-other",
            module_id="module-1",
            slug="other_concept",
            title="Other Concept",
            summary="Other concept summary.",
            concept_type="term",
            importance="supporting",
        )
        db.add_all(
            [
                owner,
                subject,
                module,
                target_group,
                other_group,
                target_card_1,
                target_card_2,
                other_card,
                existing_concept,
                old_target_concept,
                other_concept,
            ]
        )
        db.commit()
        db.add_all(
            [
                NoteGroupMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-group-1",
                    concept_id="concept-old-target",
                ),
                StudyCardMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-group-1",
                    study_card_id="study-card-1",
                    concept_id="concept-old-target",
                    role="primary",
                ),
                MindMapRelation(
                    id="relation-old-target",
                    module_id="module-1",
                    source_concept_id="concept-old-target",
                    target_concept_id="concept-existing",
                    relation_type="related_to",
                    confidence=0.9,
                    source_note_group_id="note-group-1",
                ),
                NoteGroupMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-group-2",
                    concept_id="concept-other",
                ),
                StudyCardMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-group-2",
                    study_card_id="study-card-other",
                    concept_id="concept-other",
                    role="primary",
                ),
                MindMapRelation(
                    id="relation-other",
                    module_id="module-1",
                    source_concept_id="concept-other",
                    target_concept_id="concept-existing",
                    relation_type="related_to",
                    confidence=0.8,
                    source_note_group_id="note-group-2",
                ),
            ]
        )
        db.commit()

    def test_slugify_concept_title_normalizes_backend_slugs(self):
        self.assertEqual(slugify_concept_title(" Row-Level Security! "), "row_level_security")
        self.assertEqual(slugify_concept_title("   "), "concept")

    def test_validate_candidate_graph_rejects_unresolved_relation_endpoint(self):
        payload = {
            "concepts": [
                {
                    "temp_id": "candidate-1",
                    "title": "Row-Level Security",
                    "summary": "Restricts rows by policy.",
                    "concept_type": "term",
                    "importance": "core",
                }
            ],
            "relations": [
                {
                    "source_concept_id": "candidate-1",
                    "target_concept_id": "missing",
                    "relation_type": "requires",
                    "confidence": 0.9,
                }
            ],
            "links": [
                {
                    "study_card_id": "study-card-1",
                    "concept_id": "candidate-1",
                    "role": "primary",
                }
            ],
        }

        with self.assertRaises(MindMapValidationError):
            validate_candidate_graph(payload, {"study-card-1"}, set())

    def test_validate_candidate_graph_rejects_generic_relation_endpoint_keys(self):
        payload = {
            "concepts": [
                {
                    "temp_id": "candidate-1",
                    "title": "Row-Level Security",
                    "summary": "Restricts rows by policy.",
                    "concept_type": "term",
                    "importance": "core",
                },
                {
                    "temp_id": "candidate-2",
                    "title": "Security Policies",
                    "summary": "Define row access rules.",
                    "concept_type": "principle",
                    "importance": "supporting",
                },
            ],
            "relations": [
                {
                    "source": "candidate-1",
                    "target": "candidate-2",
                    "relation_type": "requires",
                    "confidence": 0.9,
                }
            ],
            "links": [
                {
                    "study_card_id": "study-card-1",
                    "concept_id": "candidate-1",
                    "role": "primary",
                }
            ],
        }

        with self.assertRaises(MindMapValidationError):
            validate_candidate_graph(payload, {"study-card-1"}, set())

    def test_validate_candidate_graph_rejects_invalid_relation_confidence_values(self):
        for confidence in [float("nan"), float("inf"), 2.0, True]:
            with self.subTest(confidence=confidence):
                payload = {
                    "concepts": [
                        {
                            "temp_id": "candidate-1",
                            "title": "Row-Level Security",
                            "summary": "Restricts rows by policy.",
                            "concept_type": "term",
                            "importance": "core",
                        },
                        {
                            "temp_id": "candidate-2",
                            "title": "Security Policies",
                            "summary": "Define row access rules.",
                            "concept_type": "principle",
                            "importance": "supporting",
                        },
                    ],
                    "relations": [
                        {
                            "source_concept_id": "candidate-1",
                            "target_concept_id": "candidate-2",
                            "relation_type": "requires",
                            "confidence": confidence,
                        }
                    ],
                    "links": [
                        {
                            "study_card_id": "study-card-1",
                            "concept_id": "candidate-1",
                            "role": "primary",
                        }
                    ],
                }

                with self.assertRaises(MindMapValidationError):
                    validate_candidate_graph(payload, {"study-card-1"}, set())

    def test_validate_candidate_graph_rejects_duplicate_normalized_candidate_slugs(self):
        payload = {
            "concepts": [
                {
                    "temp_id": "candidate-1",
                    "title": "Row Level Security",
                    "summary": "Restricts rows by policy.",
                    "concept_type": "term",
                    "importance": "core",
                },
                {
                    "temp_id": "candidate-2",
                    "title": "row-level security",
                    "summary": "Also describes row security.",
                    "concept_type": "term",
                    "importance": "supporting",
                },
            ],
            "relations": [],
            "links": [
                {
                    "study_card_id": "study-card-1",
                    "concept_id": "candidate-1",
                    "role": "primary",
                }
            ],
        }

        with self.assertRaises(MindMapValidationError):
            validate_candidate_graph(payload, {"study-card-1"}, set())

    def test_regenerate_note_group_mind_map_replaces_target_graph_and_preserves_other_group(self):
        db = self.SessionLocal()
        try:
            self._seed_mind_map_workspace(db)
            payload = {
                "concepts": [
                    {
                        "temp_id": "existing",
                        "matched_existing_concept_id": "concept-existing",
                        "title": "Existing Security",
                        "summary": "Existing security summary.",
                        "concept_type": "topic",
                        "importance": "core",
                    },
                    {
                        "temp_id": "new",
                        "title": " Row-Level Security! ",
                        "summary": "Restricts visible rows by policy.",
                        "concept_type": "term",
                        "importance": "supporting",
                    },
                ],
                "relations": [
                    {
                        "source_concept_id": "existing",
                        "target_concept_id": "new",
                        "relation_type": "requires",
                        "label": "requires",
                        "confidence": 0.92,
                    }
                ],
                "links": [
                    {
                        "study_card_id": "study-card-1",
                        "concept_id": "existing",
                        "role": "primary",
                    },
                    {
                        "study_card_id": "study-card-1",
                        "concept_id": "new",
                        "role": "supporting",
                    },
                    {
                        "study_card_id": "study-card-2",
                        "concept_id": "new",
                        "role": "supporting",
                    },
                ],
            }

            regenerate_note_group_mind_map(db, "note-group-1", payload)
            db.commit()

            target_group = db.get(NoteGroup, "note-group-1")
            new_concept = (
                db.query(MindMapConcept)
                .filter(MindMapConcept.module_id == "module-1", MindMapConcept.slug == "row_level_security")
                .one()
            )
            target_links = {
                (link.note_group_id, link.study_card_id, link.concept_id, link.role)
                for link in db.query(StudyCardMindMapConcept)
                .filter(StudyCardMindMapConcept.note_group_id == "note-group-1")
                .all()
            }
            other_links = db.query(StudyCardMindMapConcept).filter(
                StudyCardMindMapConcept.note_group_id == "note-group-2"
            ).all()
            relation_ids = {relation.id for relation in db.query(MindMapRelation).all()}

            self.assertEqual(target_group.mind_map_status, "complete")
            self.assertFalse(target_group.mind_map_stale)
            self.assertIsNotNone(target_group.mind_map_generated_at)
            self.assertEqual(db.get(MindMapConcept, "concept-existing").id, "concept-existing")
            self.assertIn(("note-group-1", "study-card-1", "concept-existing", "primary"), target_links)
            self.assertIn(("note-group-1", "study-card-1", new_concept.id, "supporting"), target_links)
            self.assertIn(("note-group-1", "study-card-2", new_concept.id, "primary"), target_links)
            self.assertEqual(len(other_links), 1)
            self.assertEqual(other_links[0].concept_id, "concept-other")
            self.assertNotIn("relation-old-target", relation_ids)
            self.assertIn("relation-other", relation_ids)
        finally:
            db.close()

    def test_regenerate_note_group_mind_map_dedupes_links_after_concept_resolution(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", title="Target", raw_text="target")
            study_card = StudyCard(
                id="study-card-1",
                note_group_id="note-group-1",
                title="RLS",
                content="Row-level security content",
            )
            existing_concept = MindMapConcept(
                id="concept-rls",
                module_id="module-1",
                slug="row_level_security",
                title="Row Level Security",
                summary="Restricts visible rows by policy.",
                concept_type="term",
                importance="core",
            )
            db.add_all([owner, subject, module, note_group, study_card, existing_concept])
            db.commit()

            payload = {
                "concepts": [
                    {
                        "temp_id": "c1",
                        "matched_existing_concept_id": "concept-rls",
                        "title": "RLS Policy Enforcement",
                        "summary": "Uses policies to filter rows.",
                        "concept_type": "term",
                        "importance": "core",
                    },
                    {
                        "temp_id": "c2",
                        "title": "Row Level Security",
                        "summary": "Restricts rows for each user.",
                        "concept_type": "term",
                        "importance": "core",
                    },
                ],
                "relations": [
                    {
                        "source_concept_id": "c1",
                        "target_concept_id": "c2",
                        "relation_type": "related_to",
                        "confidence": 0.9,
                    }
                ],
                "links": [
                    {
                        "study_card_id": "study-card-1",
                        "concept_id": "c1",
                        "role": "supporting",
                    },
                    {
                        "study_card_id": "study-card-1",
                        "concept_id": "c2",
                        "role": "primary",
                    },
                ],
            }

            regenerate_note_group_mind_map(db, "note-group-1", payload)
            db.commit()

            links = (
                db.query(StudyCardMindMapConcept)
                .filter(
                    StudyCardMindMapConcept.study_card_id == "study-card-1",
                    StudyCardMindMapConcept.concept_id == "concept-rls",
                )
                .all()
            )
            relations = db.query(MindMapRelation).filter(MindMapRelation.source_note_group_id == "note-group-1").all()

            self.assertEqual(len(links), 1)
            self.assertEqual(links[0].role, "primary")
            self.assertEqual(relations, [])
        finally:
            db.close()

    def test_build_module_mind_map_response_is_complete_when_one_note_group_has_graph_data(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            generated_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Generated",
                raw_text="generated",
                mind_map_status="complete",
                mind_map_generated_at=datetime.utcnow(),
            )
            empty_group = NoteGroup(
                id="note-group-2",
                module_id="module-1",
                title="Empty",
                raw_text="empty",
            )
            study_card = StudyCard(
                id="study-card-1",
                note_group_id="note-group-1",
                title="RLS",
                content="Row-level security content",
            )
            concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="row_level_security",
                title="Row-Level Security",
                summary="Restricts rows.",
                concept_type="term",
                importance="core",
            )
            db.add_all([owner, subject, module, generated_group, empty_group, study_card, concept])
            db.commit()
            db.add_all(
                [
                    NoteGroupMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-group-1",
                        concept_id="concept-1",
                    ),
                    StudyCardMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-group-1",
                        study_card_id="study-card-1",
                        concept_id="concept-1",
                        role="primary",
                    ),
                ]
            )
            db.commit()

            response = build_module_mind_map_response(db, "module-1")

            self.assertEqual(response.status, "complete")
            self.assertEqual([node.id for node in response.nodes], ["concept-1"])
            self.assertEqual([card.id for card in response.study_cards], ["study-card-1"])
        finally:
            db.close()

    def test_build_note_group_mind_map_response_includes_question_cards_through_study_card_refs(self):
        db = self.SessionLocal()
        try:
            owner = User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Target",
                raw_text="target",
                mind_map_status="complete",
                mind_map_generated_at=datetime.utcnow(),
            )
            topic = TopicChip(id="topic-1", module_id="module-1", label="Security")
            study_card = StudyCard(id="study-card-1", note_group_id="note-group-1", title="RLS", content="RLS content")
            concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="row_level_security",
                title="Row-Level Security",
                summary="Restricts rows.",
                concept_type="term",
                importance="core",
            )
            question = QuestionCard(
                id="question-1",
                note_group_id="note-group-1",
                type="multiple_choice",
                prompt="What does RLS restrict?",
                options_json='["rows"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-card-1"]',
            )
            db.add_all([owner, subject, module, note_group, topic, study_card, concept, question])
            db.commit()
            db.execute(
                study_card_topic_chips.insert().values(study_card_id="study-card-1", chip_id="topic-1")
            )
            db.add_all(
                [
                    NoteGroupMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-group-1",
                        concept_id="concept-1",
                    ),
                    StudyCardMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-group-1",
                        study_card_id="study-card-1",
                        concept_id="concept-1",
                        role="primary",
                    ),
                ]
            )
            db.commit()

            response = build_note_group_mind_map_response(db, "note-group-1")

            self.assertEqual(response.scope, "note_group")
            self.assertEqual([node.id for node in response.nodes], ["concept-1"])
            self.assertEqual(response.nodes[0].topic_ids, ["topic-1"])
            self.assertEqual([card.id for card in response.study_cards], ["study-card-1"])
            self.assertEqual([card.id for card in response.question_cards], ["question-1"])
            self.assertEqual(response.question_cards[0].study_card_refs, ["study-card-1"])
        finally:
            db.close()

    def test_mind_map_relationships_serialize(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Note Group",
                source="source",
                raw_text="raw",
                mind_map_status="complete",
                mind_map_generated_at=datetime.utcnow(),
            )
            card = StudyCard(id="study-card-1", note_group_id="note-group-1", title="Card", content="Card content")
            concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="core_concept",
                title="Core Concept",
                summary="A concise concept summary.",
                concept_type="term",
                importance="core",
            )
            related_concept = MindMapConcept(
                id="concept-2",
                module_id="module-1",
                slug="related_concept",
                title="Related Concept",
                summary="A related concept summary.",
                concept_type="term",
                importance="supporting",
            )
            db.add_all([owner, subject, module, note_group, card, concept, related_concept])
            db.commit()

            link = StudyCardMindMapConcept(
                study_card_id="study-card-1",
                concept_id="concept-1",
                module_id="module-1",
                note_group_id="note-group-1",
                role="primary",
            )
            note_group_link = NoteGroupMindMapConcept(
                note_group_id="note-group-1",
                concept_id="concept-1",
                module_id="module-1",
            )
            relation = MindMapRelation(
                id="relation-1",
                module_id="module-1",
                source_concept_id="concept-1",
                target_concept_id="concept-2",
                relation_type="related_to",
                label="relates to",
                confidence=0.8,
                source_note_group_id="note-group-1",
            )
            db.add_all([link, note_group_link, relation])
            db.commit()
            db.expire_all()

            stored_note_group = db.get(NoteGroup, "note-group-1")
            stored_card = db.get(StudyCard, "study-card-1")
            stored_concept = db.get(MindMapConcept, "concept-1")
            stored_relation = db.get(MindMapRelation, "relation-1")

            self.assertEqual([item.id for item in stored_note_group.mind_map_concepts], ["concept-1"])
            self.assertEqual(len(stored_card.mind_map_concept_links), 1)
            self.assertEqual(stored_card.mind_map_concept_links[0].concept_id, "concept-1")
            self.assertEqual(stored_card.mind_map_concept_links[0].concept.title, "Core Concept")
            self.assertEqual([item.id for item in stored_concept.outgoing_relations], ["relation-1"])
            self.assertEqual(stored_relation.source_concept.id, "concept-1")
            self.assertEqual(stored_relation.source_concept.title, "Core Concept")

            response = MindMapResponse(
                scope="note_group",
                module_id="module-1",
                note_group_id="note-group-1",
                status="complete",
                stale=False,
                generated_at=note_group.mind_map_generated_at,
                nodes=[
                    {
                        "id": "concept-1",
                        "node_type": "concept",
                        "title": "Core Concept",
                        "summary": "A concise concept summary.",
                        "concept_type": "term",
                        "importance": "core",
                        "topic_ids": [],
                        "study_card_ids": ["study-card-1"],
                        "note_group_ids": ["note-group-1"],
                        "study_card_count": 1,
                        "note_group_count": 1,
                    }
                ],
                edges=[],
                study_cards=[
                    {"id": "study-card-1", "note_group_id": "note-group-1", "title": "Card", "content": "Card content"}
                ],
                question_cards=[],
                note_groups=[{"id": "note-group-1", "title": "Note Group"}],
            )

            self.assertEqual(response.nodes[0].title, "Core Concept")
            self.assertEqual(response.study_cards[0].id, "study-card-1")
        finally:
            db.close()

    def test_mind_map_enum_like_values_are_enforced_locally(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", raw_text="raw")
            card = StudyCard(id="study-card-1", note_group_id="note-group-1", content="Card content")
            valid_concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="core_concept",
                title="Core Concept",
                summary="A concise concept summary.",
                concept_type="term",
                importance="core",
            )
            other_concept = MindMapConcept(
                id="concept-2",
                module_id="module-1",
                slug="other_concept",
                title="Other Concept",
                summary="Another concept summary.",
                concept_type="topic",
                importance="supporting",
            )
            db.add_all([owner, subject, module, note_group, card, valid_concept, other_concept])
            db.commit()

            invalid_rows = [
                MindMapConcept(
                    id="concept-bad-type",
                    module_id="module-1",
                    slug="bad_type",
                    title="Bad Type",
                    summary="Invalid concept type.",
                    concept_type="theme",
                    importance="core",
                ),
                MindMapConcept(
                    id="concept-bad-importance",
                    module_id="module-1",
                    slug="bad_importance",
                    title="Bad Importance",
                    summary="Invalid importance.",
                    concept_type="term",
                    importance="major",
                ),
                MindMapRelation(
                    id="relation-bad-type",
                    module_id="module-1",
                    source_concept_id="concept-1",
                    target_concept_id="concept-2",
                    relation_type="explains",
                    source_note_group_id="note-group-1",
                ),
                StudyCardMindMapConcept(
                    study_card_id="study-card-1",
                    concept_id="concept-1",
                    module_id="module-1",
                    note_group_id="note-group-1",
                    role="main",
                ),
            ]

            for row in invalid_rows:
                with self.subTest(row=row.id if hasattr(row, "id") else row.__class__.__name__):
                    db.add(row)
                    with self.assertRaises(IntegrityError):
                        db.commit()
                    db.rollback()
        finally:
            db.close()

    def test_relation_rejects_concepts_from_other_modules_locally(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            source_module = Module(id="module-1", subject_id="subject-1", title="Source Module")
            target_module = Module(id="module-2", subject_id="subject-1", title="Target Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", raw_text="raw")
            source_concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="source_concept",
                title="Source Concept",
                summary="Source concept summary.",
                concept_type="topic",
                importance="core",
            )
            target_concept = MindMapConcept(
                id="concept-2",
                module_id="module-2",
                slug="target_concept",
                title="Target Concept",
                summary="Target concept summary.",
                concept_type="topic",
                importance="core",
            )
            db.add_all([owner, subject, source_module, target_module, note_group, source_concept, target_concept])
            db.commit()

            invalid_relations = [
                MindMapRelation(
                    id="relation-source-mismatch",
                    module_id="module-1",
                    source_concept_id="concept-2",
                    target_concept_id="concept-1",
                    relation_type="related_to",
                    source_note_group_id="note-group-1",
                ),
                MindMapRelation(
                    id="relation-target-mismatch",
                    module_id="module-1",
                    source_concept_id="concept-1",
                    target_concept_id="concept-2",
                    relation_type="related_to",
                    source_note_group_id="note-group-1",
                ),
            ]

            for relation in invalid_relations:
                with self.subTest(relation=relation.id):
                    db.add(relation)
                    with self.assertRaises(IntegrityError):
                        db.commit()
                    db.rollback()
        finally:
            db.close()

    def test_relation_rejects_source_note_group_from_other_module_locally(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            source_module = Module(id="module-1", subject_id="subject-1", title="Source Module")
            other_module = Module(id="module-2", subject_id="subject-1", title="Other Module")
            source_note_group = NoteGroup(id="note-group-1", module_id="module-1", raw_text="raw")
            other_note_group = NoteGroup(id="note-group-2", module_id="module-2", raw_text="raw")
            source_concept = MindMapConcept(
                id="concept-1",
                module_id="module-1",
                slug="source_concept",
                title="Source Concept",
                summary="Source concept summary.",
                concept_type="topic",
                importance="core",
            )
            target_concept = MindMapConcept(
                id="concept-2",
                module_id="module-1",
                slug="target_concept",
                title="Target Concept",
                summary="Target concept summary.",
                concept_type="topic",
                importance="core",
            )
            db.add_all(
                [
                    owner,
                    subject,
                    source_module,
                    other_module,
                    source_note_group,
                    other_note_group,
                    source_concept,
                    target_concept,
                ]
            )
            db.commit()

            relation = MindMapRelation(
                id="relation-note-group-mismatch",
                module_id="module-1",
                source_concept_id="concept-1",
                target_concept_id="concept-2",
                relation_type="related_to",
                source_note_group_id="note-group-2",
            )

            db.add(relation)
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()

    def test_study_card_concept_link_rejects_concept_from_other_module_locally(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            source_module = Module(id="module-1", subject_id="subject-1", title="Source Module")
            other_module = Module(id="module-2", subject_id="subject-1", title="Other Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", raw_text="raw")
            card = StudyCard(id="study-card-1", note_group_id="note-group-1", content="Card content")
            other_concept = MindMapConcept(
                id="concept-1",
                module_id="module-2",
                slug="other_concept",
                title="Other Concept",
                summary="Other concept summary.",
                concept_type="topic",
                importance="core",
            )
            db.add_all([owner, subject, source_module, other_module, note_group, card, other_concept])
            db.commit()

            link = StudyCardMindMapConcept(
                study_card_id="study-card-1",
                concept_id="concept-1",
                module_id="module-1",
                note_group_id="note-group-1",
                role="primary",
            )

            db.add(link)
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()

    def test_note_group_concept_link_rejects_concept_from_other_module_locally(self):
        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            source_module = Module(id="module-1", subject_id="subject-1", title="Source Module")
            other_module = Module(id="module-2", subject_id="subject-1", title="Other Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", raw_text="raw")
            other_concept = MindMapConcept(
                id="concept-1",
                module_id="module-2",
                slug="other_concept",
                title="Other Concept",
                summary="Other concept summary.",
                concept_type="topic",
                importance="core",
            )
            db.add_all([owner, subject, source_module, other_module, note_group, other_concept])
            db.commit()

            link = NoteGroupMindMapConcept(
                note_group_id="note-group-1",
                concept_id="concept-1",
                module_id="module-1",
            )

            db.add(link)
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()

    def test_active_mind_map_generation_job_is_unique_per_note_group(self):
        db = self.SessionLocal()
        try:
            self._seed_mind_map_workspace(db)
            db.add(
                Job(
                    id="job-1",
                    type=JOB_TYPE_MIND_MAP_GENERATION,
                    status="queued",
                    note_group_id="note-group-1",
                )
            )
            db.commit()

            db.add(
                Job(
                    id="job-2",
                    type=JOB_TYPE_MIND_MAP_GENERATION,
                    status="running",
                    note_group_id="note-group-1",
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()


class MindMapOpenAIClientTests(unittest.TestCase):
    def test_generate_mind_map_candidate_graph_returns_validator_ready_links(self):
        legacy_links = [
            {
                "study_card_id": "card-a",
                "concept_id": "concept-a",
                "role": "primary",
            }
        ]

        with patch(
            "app.openai_client._strong_high_json",
            return_value={
                "concepts": [],
                "relations": [],
                "study_card_concept_links": legacy_links,
            },
        ) as generate_json:
            payload = generate_mind_map_candidate_graph(
                module_title="Module",
                note_group_title="Note A",
                study_cards=[{"study_card_id": "card-a", "content": "Card content"}],
                existing_concepts=[],
            )

        self.assertEqual(
            payload,
            {
                "concepts": [],
                "relations": [],
                "links": legacy_links,
            },
        )
        user_prompt = generate_json.call_args.args[1]
        self.assertIn("concepts, relations, links", user_prompt)
        self.assertNotIn("study_card_concept_links", user_prompt)


class MindMapJobTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def test_run_mind_map_generation_marks_complete(self):
        db = self.SessionLocal()
        try:
            MindMapServiceTests.seed_graph_scope(self, db)
            db.add(Job(id="job-1", type=JOB_TYPE_MIND_MAP_GENERATION, note_group_id="note-a"))
            db.commit()
        finally:
            db.close()

        candidate_payload = {
            "concepts": [
                {
                    "temp_id": "concept-a",
                    "title": "Row-Level Security",
                    "summary": "Restricts visible rows by policy.",
                    "concept_type": "term",
                    "importance": "core",
                }
            ],
            "relations": [],
            "links": [
                {
                    "study_card_id": "card-a",
                    "concept_id": "concept-a",
                    "role": "primary",
                }
            ],
        }

        with patch("app.jobs.SessionLocal", self.SessionLocal), patch(
            "app.jobs.generate_mind_map_candidate_graph",
            return_value=candidate_payload,
        ):
            run_mind_map_generation("job-1")

        db = self.SessionLocal()
        try:
            job = db.get(Job, "job-1")
            note_group = db.get(NoteGroup, "note-a")
            concepts = db.query(MindMapConcept).filter(MindMapConcept.module_id == "module-1").all()

            self.assertEqual(job.status, "completed")
            self.assertIsNone(job.error)
            self.assertEqual(note_group.mind_map_status, "complete")
            self.assertEqual(len(concepts), 1)
        finally:
            db.close()

    def test_run_mind_map_generation_keeps_previous_graph_on_failure(self):
        db = self.SessionLocal()
        try:
            MindMapServiceTests.seed_graph_scope(self, db)
            existing_concept = MindMapConcept(
                id="concept-existing",
                module_id="module-1",
                slug="existing_security",
                title="Existing Security",
                summary="Existing security summary.",
                concept_type="topic",
                importance="core",
            )
            db.add(existing_concept)
            db.commit()
            db.add_all(
                [
                    NoteGroupMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-a",
                        concept_id="concept-existing",
                    ),
                    StudyCardMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-a",
                        study_card_id="card-a",
                        concept_id="concept-existing",
                        role="primary",
                    ),
                    Job(id="job-1", type=JOB_TYPE_MIND_MAP_GENERATION, note_group_id="note-a"),
                ]
            )
            db.commit()
        finally:
            db.close()

        with patch("app.jobs.SessionLocal", self.SessionLocal), patch(
            "app.jobs.generate_mind_map_candidate_graph",
            side_effect=RuntimeError("LLM failed"),
        ):
            run_mind_map_generation("job-1")

        db = self.SessionLocal()
        try:
            job = db.get(Job, "job-1")
            note_group = db.get(NoteGroup, "note-a")
            note_group_links = (
                db.query(NoteGroupMindMapConcept)
                .filter(NoteGroupMindMapConcept.note_group_id == "note-a")
                .all()
            )
            study_card_links = (
                db.query(StudyCardMindMapConcept)
                .filter(StudyCardMindMapConcept.note_group_id == "note-a")
                .all()
            )

            self.assertEqual(job.status, "failed")
            self.assertEqual(job.error, "LLM failed")
            self.assertEqual(note_group.mind_map_status, "failed")
            self.assertEqual(
                [(link.note_group_id, link.concept_id) for link in note_group_links],
                [("note-a", "concept-existing")],
            )
            self.assertEqual(
                [(link.study_card_id, link.concept_id, link.role) for link in study_card_links],
                [("card-a", "concept-existing", "primary")],
            )
        finally:
            db.close()

    def test_run_mind_map_generation_marks_failed_when_note_group_has_no_study_cards(self):
        db = self.SessionLocal()
        try:
            owner = User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(id="note-a", module_id="module-1", title="Note A", raw_text="target")
            job = Job(id="job-1", type=JOB_TYPE_MIND_MAP_GENERATION, note_group_id="note-a")
            db.add_all([owner, subject, module, note_group, job])
            db.commit()
        finally:
            db.close()

        with patch("app.jobs.SessionLocal", self.SessionLocal), patch(
            "app.jobs.generate_mind_map_candidate_graph",
        ) as generate_graph:
            run_mind_map_generation("job-1")

        db = self.SessionLocal()
        try:
            job = db.get(Job, "job-1")
            note_group = db.get(NoteGroup, "note-a")

            self.assertEqual(job.status, "failed")
            self.assertEqual(job.error, "No Study Cards available for Concept Mind Map generation")
            self.assertEqual(note_group.mind_map_status, "failed")
            generate_graph.assert_not_called()
        finally:
            db.close()

    def test_run_mind_map_generation_keeps_previous_graph_on_malformed_payload(self):
        db = self.SessionLocal()
        try:
            MindMapServiceTests.seed_graph_scope(self, db)
            existing_concept = MindMapConcept(
                id="concept-existing",
                module_id="module-1",
                slug="existing_security",
                title="Existing Security",
                summary="Existing security summary.",
                concept_type="topic",
                importance="core",
            )
            db.add(existing_concept)
            db.commit()
            db.add_all(
                [
                    NoteGroupMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-a",
                        concept_id="concept-existing",
                    ),
                    StudyCardMindMapConcept(
                        module_id="module-1",
                        note_group_id="note-a",
                        study_card_id="card-a",
                        concept_id="concept-existing",
                        role="primary",
                    ),
                    Job(id="job-1", type=JOB_TYPE_MIND_MAP_GENERATION, note_group_id="note-a"),
                ]
            )
            db.commit()
        finally:
            db.close()

        malformed_payload = {
            "concepts": [
                {
                    "temp_id": "concept-a",
                    "title": "Row-Level Security",
                    "summary": "Restricts visible rows by policy.",
                    "concept_type": "term",
                    "importance": "core",
                }
            ],
            "relations": [],
        }

        with patch("app.jobs.SessionLocal", self.SessionLocal), patch(
            "app.jobs.generate_mind_map_candidate_graph",
            return_value=malformed_payload,
        ):
            run_mind_map_generation("job-1")

        db = self.SessionLocal()
        try:
            job = db.get(Job, "job-1")
            note_group = db.get(NoteGroup, "note-a")
            note_group_links = (
                db.query(NoteGroupMindMapConcept)
                .filter(NoteGroupMindMapConcept.note_group_id == "note-a")
                .all()
            )
            study_card_links = (
                db.query(StudyCardMindMapConcept)
                .filter(StudyCardMindMapConcept.note_group_id == "note-a")
                .all()
            )

            self.assertEqual(job.status, "failed")
            self.assertEqual(job.error, "Candidate graph links must be a list.")
            self.assertEqual(note_group.mind_map_status, "failed")
            self.assertEqual(
                [(link.note_group_id, link.concept_id) for link in note_group_links],
                [("note-a", "concept-existing")],
            )
            self.assertEqual(
                [(link.study_card_id, link.concept_id, link.role) for link in study_card_links],
                [("card-a", "concept-existing", "primary")],
            )
        finally:
            db.close()


class MindMapRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
            expire_on_commit=False,
        )

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def seed_graph_scope(self, db):
        owner = User(id="owner-1", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
        module = Module(id="module-1", subject_id="subject-1", title="Module")
        note_group = NoteGroup(id="note-a", module_id="module-1", title="Note A", raw_text="target")
        topic = TopicChip(id="topic-a", module_id="module-1", label="Security")
        study_card = StudyCard(
            id="card-a",
            note_group_id="note-a",
            title="RLS",
            content="Row-level security content",
        )
        concept = MindMapConcept(
            id="concept-a",
            module_id="module-1",
            slug="row_level_security",
            title="Row-Level Security",
            summary="Restricts rows by policy.",
            concept_type="term",
            importance="core",
        )
        db.add_all([owner, subject, module, note_group, topic, study_card, concept])
        db.commit()
        db.execute(study_card_topic_chips.insert().values(study_card_id="card-a", chip_id="topic-a"))
        db.add_all(
            [
                NoteGroupMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-a",
                    concept_id="concept-a",
                ),
                StudyCardMindMapConcept(
                    module_id="module-1",
                    note_group_id="note-a",
                    study_card_id="card-a",
                    concept_id="concept-a",
                    role="primary",
                ),
            ]
        )
        db.commit()

    def _client(self, user=None):
        import app.db as db_module
        from app.auth import optional_user, require_user
        from app.db import get_db

        with patch.object(db_module, "engine", self.engine):
            from app.main import app

        def override_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        def override_optional_user():
            return user

        def override_require_user():
            if user is None:
                raise HTTPException(status_code=401, detail="Authentication required")
            return user

        overrides = {
            get_db: override_db,
            optional_user: override_optional_user,
            require_user: override_require_user,
        }
        previous_overrides = {
            dependency: app.dependency_overrides.get(dependency)
            for dependency in overrides
        }
        app.dependency_overrides.update(overrides)

        def restore_overrides():
            for dependency, previous_override in previous_overrides.items():
                if previous_override is None:
                    app.dependency_overrides.pop(dependency, None)
                else:
                    app.dependency_overrides[dependency] = previous_override

        self.addCleanup(restore_overrides)
        return TestClient(app)

    def test_reader_can_read_but_cannot_generate(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            reader = User(
                id="reader-1",
                supabase_user_id="reader-sub",
                email="reader@example.com",
                app_role="reader",
            )
            db.add_all(
                [
                    reader,
                    SubjectAccess(
                        id="reader-grant",
                        subject_id="subject-1",
                        user_id="reader-1",
                        access_level=SUBJECT_ACCESS_READER,
                    ),
                ]
            )
            db.commit()
        finally:
            db.close()

        client = self._client(user=reader)

        self.assertEqual(client.get("/note-groups/note-a/mind-map").status_code, 200)
        self.assertEqual(client.get("/modules/module-1/mind-map").status_code, 200)
        self.assertEqual(client.post("/note-groups/note-a/mind-map/generate").status_code, 403)

    def test_public_anonymous_can_read_public_map(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            subject = db.get(Subject, "subject-1")
            subject.visibility = SUBJECT_VISIBILITY_PUBLIC
            db.commit()
        finally:
            db.close()

        client = self._client(user=None)

        self.assertEqual(client.get("/note-groups/note-a/mind-map").status_code, 200)
        self.assertEqual(client.get("/modules/module-1/mind-map").status_code, 200)

    def test_maintainer_can_start_generation_job(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            maintainer = User(
                id="maintainer-1",
                supabase_user_id="maintainer-sub",
                email="maintainer@example.com",
                app_role="reader",
            )
            db.add_all(
                [
                    maintainer,
                    SubjectAccess(
                        id="maintainer-grant",
                        subject_id="subject-1",
                        user_id="maintainer-1",
                        access_level=SUBJECT_ACCESS_MAINTAINER,
                    ),
                ]
            )
            db.commit()
        finally:
            db.close()

        client = self._client(user=maintainer)

        with patch("app.main.run_mind_map_generation") as run_generation:
            response = client.post("/note-groups/note-a/mind-map/generate")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["type"], JOB_TYPE_MIND_MAP_GENERATION)
        self.assertEqual(response.json()["status"], "queued")
        run_generation.assert_called_once()

        db = self.SessionLocal()
        try:
            note_group = db.get(NoteGroup, "note-a")
            self.assertEqual(note_group.mind_map_status, "queued")
            jobs = db.query(Job).filter(Job.note_group_id == "note-a").all()
            self.assertEqual(len(jobs), 1)
        finally:
            db.close()

    def test_existing_queued_generation_job_is_returned_and_rescheduled(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            owner = db.get(User, "owner-1")
            db.add(
                Job(
                    id="job-queued",
                    type=JOB_TYPE_MIND_MAP_GENERATION,
                    status="queued",
                    note_group_id="note-a",
                )
            )
            db.commit()
        finally:
            db.close()

        client = self._client(user=owner)

        with patch("app.main.run_mind_map_generation") as run_generation:
            response = client.post("/note-groups/note-a/mind-map/generate")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "job-queued")
        self.assertEqual(response.json()["status"], "queued")
        run_generation.assert_called_once_with("job-queued")

        db = self.SessionLocal()
        try:
            jobs = db.query(Job).filter(Job.note_group_id == "note-a").all()
            self.assertEqual([job.id for job in jobs], ["job-queued"])
        finally:
            db.close()

    def test_recent_running_generation_job_is_returned_without_duplicate(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            owner = db.get(User, "owner-1")
            db.add(
                Job(
                    id="job-running",
                    type=JOB_TYPE_MIND_MAP_GENERATION,
                    status="running",
                    note_group_id="note-a",
                    updated_at=datetime.utcnow() - timedelta(minutes=5),
                )
            )
            db.commit()
        finally:
            db.close()

        client = self._client(user=owner)

        with patch("app.main.run_mind_map_generation") as run_generation:
            response = client.post("/note-groups/note-a/mind-map/generate")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "job-running")
        self.assertEqual(response.json()["status"], "running")
        run_generation.assert_not_called()

        db = self.SessionLocal()
        try:
            jobs = db.query(Job).filter(Job.note_group_id == "note-a").all()
            self.assertEqual([job.id for job in jobs], ["job-running"])
        finally:
            db.close()

    def test_stale_running_generation_job_is_failed_and_new_job_is_scheduled(self):
        db = self.SessionLocal()
        try:
            self.seed_graph_scope(db)
            owner = db.get(User, "owner-1")
            db.add(
                Job(
                    id="job-stale",
                    type=JOB_TYPE_MIND_MAP_GENERATION,
                    status="running",
                    note_group_id="note-a",
                    updated_at=datetime.utcnow() - timedelta(minutes=31),
                    created_at=datetime.utcnow() - timedelta(minutes=31),
                )
            )
            db.commit()
        finally:
            db.close()

        client = self._client(user=owner)

        with patch("app.main.run_mind_map_generation") as run_generation:
            response = client.post("/note-groups/note-a/mind-map/generate")

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()["id"], "job-stale")
        self.assertEqual(response.json()["status"], "queued")
        run_generation.assert_called_once_with(response.json()["id"])

        db = self.SessionLocal()
        try:
            stale_job = db.get(Job, "job-stale")
            self.assertEqual(stale_job.status, "failed")
            self.assertEqual(stale_job.error, "Stale Concept Mind Map generation job superseded")
            active_jobs = (
                db.query(Job)
                .filter(
                    Job.note_group_id == "note-a",
                    Job.type == JOB_TYPE_MIND_MAP_GENERATION,
                    Job.status.in_(("queued", "running")),
                )
                .all()
            )
            self.assertEqual(len(active_jobs), 1)
            self.assertEqual(active_jobs[0].id, response.json()["id"])
        finally:
            db.close()
