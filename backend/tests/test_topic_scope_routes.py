import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine, event
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

    def test_concept_routes_return_concept_named_scope_data(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import (
                get_concept_question_timeline,
                list_concept_question_cards,
                list_concept_study_cards,
                list_concepts,
            )

        db = self.seed_topic_scope()
        try:
            user = db.get(User, "user-1")
            concepts = list_concepts("module-1", db=db, current_user=user)
            study_response = list_concept_study_cards("topic-1", db=db, current_user=user)
            question_response = list_concept_question_cards("topic-1", db=db, current_user=user)
            timeline_response = get_concept_question_timeline("topic-1", db=db, current_user=user)
        finally:
            db.close()

        self.assertEqual(concepts[0]["concept_id"], "topic-1")
        self.assertEqual(concepts[0]["parent_concept_id"], None)
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

    def test_concept_study_cards_include_descendants_by_default_and_deduplicate(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import list_concept_study_cards

        db = self.seed_topic_scope()
        try:
            module = db.get(Module, "module-1")
            parent = db.get(TopicChip, "topic-1")
            child = TopicChip(id="topic-child", module_id=module.id, label="Child", parent_topic_id=parent.id)
            grandchild = TopicChip(
                id="topic-grandchild",
                module_id=module.id,
                label="Grandchild",
                parent_topic_id=child.id,
            )
            group = db.get(NoteGroup, "group-b")
            child_card = StudyCard(id="study-child", note_group_id=group.id, title="Child", content="Child")
            shared_card = StudyCard(id="study-shared", note_group_id=group.id, title="Shared", content="Shared")
            grandchild_card = StudyCard(
                id="study-grandchild",
                note_group_id=group.id,
                title="Grandchild",
                content="Grandchild",
            )
            child_card.topic_chips.append(child)
            shared_card.topic_chips.append(parent)
            shared_card.topic_chips.append(child)
            grandchild_card.topic_chips.append(grandchild)
            db.add_all([child, grandchild, child_card, shared_card, grandchild_card])
            db.commit()

            user = db.get(User, "user-1")
            default_response = list_concept_study_cards("topic-1", db=db, current_user=user)
            direct_response = list_concept_study_cards(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
        finally:
            db.close()

        self.assertEqual(
            {card.id for card in default_response["study_cards"]},
            {"study-a", "study-b", "study-child", "study-shared", "study-grandchild"},
        )
        self.assertEqual(
            {card.id for card in direct_response["study_cards"]},
            {"study-a", "study-b", "study-shared"},
        )
        self.assertEqual(
            len([card for card in default_response["study_cards"] if card.id == "study-shared"]),
            1,
        )

    def test_concept_question_and_review_cards_follow_descendant_scope(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import (
                get_concept_question_timeline,
                list_concept_question_cards,
                list_concept_review_question_cards,
            )

        db = self.seed_topic_scope()
        try:
            module = db.get(Module, "module-1")
            parent = db.get(TopicChip, "topic-1")
            child = TopicChip(id="topic-child", module_id=module.id, label="Child", parent_topic_id=parent.id)
            group = db.get(NoteGroup, "group-b")
            child_card = StudyCard(id="study-child", note_group_id=group.id, title="Child", content="Child")
            child_card.topic_chips.append(child)
            child_question = QuestionCard(
                id="question-child",
                note_group_id=group.id,
                type="multiple_choice",
                prompt="Child prompt",
                options_json='["A"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-child"]',
                stale=False,
                due_at=datetime.utcnow() - timedelta(hours=1),
            )
            db.add_all([child, child_card, child_question])
            db.commit()

            user = db.get(User, "user-1")
            default_questions = list_concept_question_cards("topic-1", db=db, current_user=user)
            direct_questions = list_concept_question_cards(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
            default_timeline = get_concept_question_timeline("topic-1", db=db, current_user=user)
            direct_timeline = get_concept_question_timeline(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
            default_review = list_concept_review_question_cards(
                "topic-1",
                mode="due",
                limit=10,
                db=db,
                current_user=user,
            )
            direct_review = list_concept_review_question_cards(
                "topic-1",
                mode="due",
                limit=10,
                include_descendants=False,
                db=db,
                current_user=user,
            )
        finally:
            db.close()

        self.assertIn("question-child", [card["id"] for card in default_questions["question_cards"]])
        self.assertNotIn("question-child", [card["id"] for card in direct_questions["question_cards"]])
        self.assertEqual(default_timeline["question_count"], 3)
        self.assertEqual(direct_timeline["question_count"], 2)
        self.assertIn("question-child", [card["id"] for card in default_review["question_cards"]])
        self.assertNotIn("question-child", [card["id"] for card in direct_review["question_cards"]])

    def test_legacy_topic_routes_delegate_to_concept_handlers(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import list_concept_study_cards, list_topic_study_cards

        db = self.seed_topic_scope()
        try:
            user = db.get(User, "user-1")
            concept_response = list_concept_study_cards("topic-1", db=db, current_user=user)
            topic_response = list_topic_study_cards("topic-1", db=db, current_user=user)
        finally:
            db.close()

        self.assertEqual(
            [card.id for card in topic_response["study_cards"]],
            [card.id for card in concept_response["study_cards"]],
        )

    def test_topic_allowed_study_query_avoids_postgres_distinct_order_by_conflict(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import _topic_allowed_study_ids

        db = self.seed_topic_scope()
        captured_sql = []

        def capture_sql(conn, cursor, statement, parameters, context, executemany):
            if "study_card_topic_chips" in statement:
                captured_sql.append(statement.lower())

        event.listen(self.engine, "before_cursor_execute", capture_sql)
        try:
            topic = db.get(TopicChip, "topic-1")
            study_ids = _topic_allowed_study_ids(db, topic)
        finally:
            event.remove(self.engine, "before_cursor_execute", capture_sql)
            db.close()

        self.assertEqual(study_ids, ["study-a", "study-b"])
        self.assertTrue(captured_sql)
        self.assertNotIn("select distinct study_cards.id", captured_sql[-1])

    def test_delete_topic_removes_associations_without_deleting_cards(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
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
