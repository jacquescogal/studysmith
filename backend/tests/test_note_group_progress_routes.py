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

    def test_review_submission_creates_review_history_event(self):
        from app.main import review_question
        from app.schemas import QuestionCardReview

        db = self.seed_review_scope()
        try:
            result = review_question(
                "question-1",
                QuestionCardReview(
                    correct=True,
                    response_time_ms=1200,
                    answer_option_indices=[1],
                ),
                db=db,
            )
            events = db.query(QuestionCardReviewEvent).all()
        finally:
            db.close()

        self.assertEqual(result["id"], "question-1")
        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event.question_card_id, "question-1")
        self.assertEqual(event.note_group_id, "group-1")
        self.assertEqual(event.module_id, "module-1")
        self.assertTrue(event.correct)
        self.assertEqual(event.response_time_ms, 1200)
        self.assertEqual(event.rating, "easy")
        self.assertEqual(json.loads(event.answer_option_indices_json), [1])
        self.assertEqual(json.loads(event.correct_option_indices_json), [1])
        self.assertEqual(event.previous_reps, 0)
        self.assertEqual(event.previous_state, 1)
        self.assertEqual(event.next_state, 2)
        self.assertNotEqual(event.previous_difficulty, event.next_difficulty)

    def test_note_group_progress_uses_review_history(self):
        from app.main import get_note_group_progress

        db = self.seed_review_scope()
        try:
            db.add_all(
                [
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=True,
                        response_time_ms=1000,
                        rating="easy",
                        previous_due_at=datetime.utcnow(),
                        next_due_at=datetime.utcnow() + timedelta(days=1),
                        previous_difficulty=5.0,
                        next_difficulty=4.5,
                        previous_stability=2.0,
                        next_stability=3.0,
                        previous_state=1,
                        next_state=2,
                        previous_reps=0,
                        next_reps=1,
                        previous_lapses=0,
                        next_lapses=0,
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow() - timedelta(days=1),
                    ),
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=False,
                        response_time_ms=3000,
                        rating="again",
                        previous_due_at=datetime.utcnow(),
                        next_due_at=datetime.utcnow(),
                        previous_difficulty=4.5,
                        next_difficulty=5.2,
                        previous_stability=3.0,
                        next_stability=1.0,
                        previous_state=2,
                        next_state=1,
                        previous_reps=1,
                        next_reps=2,
                        previous_lapses=0,
                        next_lapses=1,
                        answer_option_indices_json="[0]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow(),
                    ),
                ]
            )
            db.commit()
            data = get_note_group_progress("group-1", range="30d", chip_ids=None, db=db)
        finally:
            db.close()

        self.assertEqual(data["summary"]["total_reviews"], 2)
        self.assertEqual(data["summary"]["success_rate"], 50.0)
        self.assertEqual(data["summary"]["median_response_time_ms"], 2000)
        self.assertEqual(data["summary"]["reviewed_card_count"], 1)
        self.assertEqual(data["mastery_distribution"]["medium"], 1)
        self.assertEqual(data["activity"][-1]["incorrect"], 1)

    def test_note_group_progress_respects_topic_filter(self):
        from app.main import get_note_group_progress

        db = self.seed_review_scope()
        try:
            other_study = StudyCard(id="study-2", note_group_id="group-1", title="Other", content="Other")
            other_question = QuestionCard(
                id="question-2",
                note_group_id="group-1",
                type="mcq",
                prompt="Other prompt",
                options_json='["A", "B"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-2"]',
                stale=False,
                due_at=datetime.utcnow(),
            )
            db.add_all([other_study, other_question])
            db.add_all(
                [
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=True,
                        response_time_ms=1000,
                        rating="easy",
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow(),
                    ),
                    QuestionCardReviewEvent(
                        question_card_id="question-2",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=False,
                        response_time_ms=2000,
                        rating="again",
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[0]",
                        reviewed_at=datetime.utcnow(),
                    ),
                ]
            )
            db.commit()
            data = get_note_group_progress("group-1", range="30d", chip_ids="topic-1", db=db)
        finally:
            db.close()

        self.assertEqual(data["summary"]["total_reviews"], 1)
        self.assertEqual(data["summary"]["success_rate"], 100.0)

    def test_question_card_performance_sorts_by_success_rate(self):
        from app.main import get_note_group_question_card_performance

        db = self.seed_review_scope()
        try:
            hard = QuestionCard(
                id="question-hard",
                note_group_id="group-1",
                type="mcq",
                prompt="Hard",
                options_json='["A", "B"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-1"]',
                stale=True,
                difficulty=8.0,
                lapses=2,
                due_at=datetime.utcnow(),
            )
            db.add(hard)
            db.add_all(
                [
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=True,
                        response_time_ms=1000,
                        rating="easy",
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow(),
                    ),
                    QuestionCardReviewEvent(
                        question_card_id="question-hard",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=False,
                        response_time_ms=4000,
                        rating="again",
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[0]",
                        reviewed_at=datetime.utcnow(),
                    ),
                ]
            )
            db.commit()
            data = get_note_group_question_card_performance(
                "group-1",
                range="30d",
                sort="success_rate",
                direction="asc",
                mastery="all",
                stale=None,
                reviewed="all",
                attention=False,
                chip_ids=None,
                db=db,
            )
        finally:
            db.close()

        self.assertEqual(data["rows"][0]["id"], "question-hard")
        self.assertEqual(data["rows"][0]["success_rate"], 0.0)
        self.assertTrue(data["rows"][0]["stale"])

    def test_note_group_card_table_groups_question_cards_by_study_card(self):
        from app.main import get_note_group_card_table

        db = self.seed_review_scope()
        try:
            other_study = StudyCard(
                id="study-2",
                note_group_id="group-1",
                title="Other Study",
                content="Other",
            )
            linked_question = QuestionCard(
                id="question-2",
                note_group_id="group-1",
                type="mcq",
                prompt="Linked prompt",
                options_json='["A", "B"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-1", "study-2"]',
                stale=False,
                due_at=datetime.utcnow(),
            )
            unlinked_question = QuestionCard(
                id="question-3",
                note_group_id="group-1",
                type="mcq",
                prompt="Unlinked prompt",
                options_json='["A", "B"]',
                correct_option_indices_json="[0]",
                study_card_refs_json="[]",
                stale=False,
                due_at=datetime.utcnow(),
            )
            db.add_all([other_study, linked_question, unlinked_question])
            db.add_all(
                [
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=True,
                        response_time_ms=1000,
                        rating="easy",
                        answer_option_indices_json="[1]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow(),
                    ),
                    QuestionCardReviewEvent(
                        question_card_id="question-1",
                        note_group_id="group-1",
                        module_id="module-1",
                        correct=False,
                        response_time_ms=3000,
                        rating="again",
                        answer_option_indices_json="[0]",
                        correct_option_indices_json="[1]",
                        reviewed_at=datetime.utcnow(),
                    ),
                ]
            )
            db.commit()

            data = get_note_group_card_table("group-1", db=db)
        finally:
            db.close()

        self.assertEqual([row["study_card"]["id"] for row in data["rows"]], ["study-1", "study-2"])
        self.assertEqual(data["rows"][0]["study_card"]["title"], "Study")
        self.assertEqual(
            [question["prompt"] for question in data["rows"][0]["question_cards"]],
            ["Prompt", "Linked prompt"],
        )
        first_question = data["rows"][0]["question_cards"][0]
        self.assertEqual(first_question["mastery"], 5.0)
        self.assertEqual(first_question["mastery_tier"], "medium")
        self.assertEqual(first_question["success_rate"], 50.0)
        self.assertEqual(first_question["median_response_time_ms"], 2000)
        self.assertEqual(first_question["reviews"], 2)
        self.assertIsNotNone(first_question["due_at"])
        self.assertEqual(
            [question["prompt"] for question in data["rows"][1]["question_cards"]],
            ["Linked prompt"],
        )
        self.assertEqual(data["unlinked_question_count"], 1)


if __name__ == "__main__":
    unittest.main()
