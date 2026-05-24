import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import (
    MindMapConcept,
    MindMapRelation,
    Module,
    NoteGroup,
    StudyCard,
    StudyCardMindMapConcept,
    Subject,
)
from app.schemas import MindMapResponse


class MindMapModelTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def test_note_group_has_mind_map_status_defaults(self):
        db = self.SessionLocal()
        try:
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Note Group",
                source="source",
                raw_text="raw",
            )
            db.add_all([subject, module, note_group])
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
            link = StudyCardMindMapConcept(
                study_card_id="study-card-1",
                concept_id="concept-1",
                role="primary",
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
            db.add_all([subject, module, note_group, card, concept, related_concept, link, relation])
            db.commit()

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
