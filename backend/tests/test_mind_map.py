import unittest
from datetime import datetime

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import (
    MindMapConcept,
    MindMapRelation,
    Module,
    NoteGroup,
    NoteGroupMindMapConcept,
    StudyCard,
    StudyCardMindMapConcept,
    Subject,
    User,
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
                role="primary",
            )
            note_group_link = NoteGroupMindMapConcept(
                note_group_id="note-group-1",
                concept_id="concept-1",
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
