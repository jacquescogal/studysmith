import json
import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import (
    Module,
    NoteGroup,
    QuestionCard,
    QuestionCardReviewEvent,
    StudyCard,
    Subject,
    TopicChip,
)


class NoteGroupProgressRoutesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def seed_review_scope(self):
        db = self.SessionLocal()
        subject = Subject(id="subject-1", title="Subject")
        module = Module(id="module-1", subject_id=subject.id, title="Module")
        topic = TopicChip(id="topic-1", module_id=module.id, label="Caching")
        group = NoteGroup(id="group-1", module_id=module.id, title="Group", raw_text="Raw")
        study = StudyCard(id="study-1", note_group_id=group.id, title="Study", content="Study")
        study.topic_chips.append(topic)
        question = QuestionCard(
            id="question-1",
            note_group_id=group.id,
            type="mcq",
            prompt="Prompt",
            options_json=json.dumps(["A", "B"]),
            correct_option_indices_json=json.dumps([1]),
            option_explanations_json=json.dumps(["No", "Yes"]),
            study_card_refs_json=json.dumps(["study-1"]),
            stale=False,
            due_at=datetime.utcnow() - timedelta(hours=1),
            difficulty=5.0,
            stability=2.0,
            reps=0,
            lapses=0,
            state=1,
        )
        db.add_all([subject, module, topic, group, study, question])
        db.commit()
        return db

    def test_review_history_table_is_available(self):
        db = self.seed_review_scope()
        try:
            event = QuestionCardReviewEvent(
                question_card_id="question-1",
                note_group_id="group-1",
                module_id="module-1",
                correct=True,
                response_time_ms=1200,
                rating="easy",
                previous_due_at=datetime.utcnow(),
                next_due_at=datetime.utcnow() + timedelta(days=1),
                previous_difficulty=5.0,
                next_difficulty=4.8,
                previous_stability=2.0,
                next_stability=2.4,
                previous_state=1,
                next_state=2,
                previous_reps=0,
                next_reps=1,
                previous_lapses=0,
                next_lapses=0,
                answer_option_indices_json=json.dumps([1]),
                correct_option_indices_json=json.dumps([1]),
            )
            db.add(event)
            db.commit()
            rows = db.query(QuestionCardReviewEvent).all()
        finally:
            db.close()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].question_card_id, "question-1")
        self.assertEqual(rows[0].rating, "easy")


if __name__ == "__main__":
    unittest.main()
