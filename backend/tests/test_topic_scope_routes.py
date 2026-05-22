import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Module, NoteGroup, QuestionCard, StudyCard, Subject, TopicChip, User


class TopicScopeRoutesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def seed_topic_scope(self):
        db = self.SessionLocal()
        user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="creator")
        subject = Subject(id="subject-1", title="Subject", owner_user_id=user.id)
        module = Module(id="module-1", subject_id=subject.id, title="Module")
        topic = TopicChip(id="topic-1", module_id=module.id, label="Caching")
        other_topic = TopicChip(id="topic-2", module_id=module.id, label="Queues")
        group_a = NoteGroup(id="group-a", module_id=module.id, title="Group A", raw_text="Raw A")
        group_b = NoteGroup(id="group-b", module_id=module.id, title="Group B", raw_text="Raw B")
        study_a = StudyCard(id="study-a", note_group_id=group_a.id, title="A", content="A")
        study_b = StudyCard(id="study-b", note_group_id=group_b.id, title="B", content="B")
        study_c = StudyCard(id="study-c", note_group_id=group_b.id, title="C", content="C")
        study_a.topic_chips.append(topic)
        study_b.topic_chips.append(topic)
        study_c.topic_chips.append(other_topic)
        due_question = QuestionCard(
            id="question-a",
            note_group_id=group_a.id,
            type="multiple_choice",
            prompt="Prompt A",
            options_json='["A"]',
            correct_option_indices_json="[0]",
            study_card_refs_json='["study-a"]',
            stale=False,
            due_at=datetime.utcnow() - timedelta(hours=1),
        )
        later_question = QuestionCard(
            id="question-b",
            note_group_id=group_b.id,
            type="multiple_choice",
            prompt="Prompt B",
            options_json='["B"]',
            correct_option_indices_json="[0]",
            study_card_refs_json='["study-b"]',
            stale=True,
            due_at=datetime.utcnow() + timedelta(days=3),
        )
        excluded_question = QuestionCard(
            id="question-c",
            note_group_id=group_b.id,
            type="multiple_choice",
            prompt="Prompt C",
            options_json='["C"]',
            correct_option_indices_json="[0]",
            study_card_refs_json='["study-c"]',
            stale=False,
            due_at=datetime.utcnow() - timedelta(hours=1),
        )
        db.add_all(
            [
                user,
                subject,
                module,
                topic,
                other_topic,
                group_a,
                group_b,
                study_a,
                study_b,
                study_c,
                due_question,
                later_question,
                excluded_question,
            ]
        )
        db.commit()
        return db

    def test_topic_scope_uses_tagged_study_cards_across_module(self):
        from app.main import (
            get_topic_question_timeline,
            list_topic_question_cards,
            list_topic_study_cards,
        )

        db = self.seed_topic_scope()
        try:
            user = db.get(User, "user-1")
            study_response = list_topic_study_cards("topic-1", db=db, current_user=user)
            question_response = list_topic_question_cards("topic-1", db=db, current_user=user)
            timeline_response = get_topic_question_timeline("topic-1", db=db, current_user=user)
        finally:
            db.close()

        self.assertEqual(
            [card.id for card in study_response["study_cards"]],
            ["study-a", "study-b"],
        )
        self.assertEqual(
            [card["id"] for card in question_response["question_cards"]],
            ["question-a", "question-b"],
        )
        self.assertEqual(timeline_response["question_count"], 2)
        self.assertEqual(timeline_response["stale_count"], 1)
        self.assertEqual(timeline_response["timeline"]["due"], 1)

    def test_delete_topic_removes_associations_without_deleting_cards(self):
        from app.main import delete_topic
        from app.models import note_group_topic_chips, study_card_topic_chips

        db = self.seed_topic_scope()
        try:
            topic = db.get(TopicChip, "topic-1")
            note_group = db.get(NoteGroup, "group-a")
            note_group.topic_chips.append(topic)
            db.commit()

            result = delete_topic("topic-1", db=db, current_user=db.get(User, "user-1"))
            remaining_study_ids = {row[0] for row in db.query(StudyCard.id).all()}
            remaining_question_ids = {row[0] for row in db.query(QuestionCard.id).all()}
            study_links = db.execute(study_card_topic_chips.select()).all()
            note_group_links = db.execute(note_group_topic_chips.select()).all()
        finally:
            db.close()

        self.assertEqual(result, {"deleted": True})
        self.assertIn("study-a", remaining_study_ids)
        self.assertIn("question-a", remaining_question_ids)
        self.assertFalse(any(row.chip_id == "topic-1" for row in study_links))
        self.assertFalse(any(row.chip_id == "topic-1" for row in note_group_links))


if __name__ == "__main__":
    unittest.main()
