import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Module, NoteGroup, QuestionCard, StudyCard, Subject, TopicChip, User


class ModuleOverviewRoutesTests(unittest.TestCase):
    def test_module_overview_route_is_exposed(self):
        from app.main import app

        routes = {
            (route.path, ",".join(sorted(route.methods or [])))
            for route in app.routes
            if hasattr(route, "methods")
        }

        self.assertIn(("/modules/{module_id}/overview", "GET"), routes)

    def test_module_overview_applies_chip_filter_to_stats_not_note_groups(self):
        from app.main import get_module_overview

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        db = TestingSessionLocal()
        try:
            user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=user.id)
            module = Module(id="module-1", subject_id=subject.id, title="Module")
            keep_chip = TopicChip(id="chip-keep", module_id=module.id, label="Keep")
            other_chip = TopicChip(id="chip-other", module_id=module.id, label="Other")
            group_a = NoteGroup(
                id="group-a",
                module_id=module.id,
                title="Group A",
                raw_text="Raw A",
                generation_status="complete",
                sort_order=1,
            )
            group_b = NoteGroup(
                id="group-b",
                module_id=module.id,
                title="Group B",
                raw_text="Raw B",
                generation_status="complete",
                sort_order=2,
            )
            study_a = StudyCard(
                id="study-a",
                note_group_id=group_a.id,
                title="Study A",
                content="A",
            )
            study_b = StudyCard(
                id="study-b",
                note_group_id=group_b.id,
                title="Study B",
                content="B",
            )
            study_a.topic_chips.append(keep_chip)
            study_b.topic_chips.append(other_chip)
            question_a = QuestionCard(
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
            question_b = QuestionCard(
                id="question-b",
                note_group_id=group_b.id,
                type="multiple_choice",
                prompt="Prompt B",
                options_json='["B"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-b"]',
                stale=True,
                due_at=datetime.utcnow() + timedelta(days=10),
            )
            db.add_all(
                [
                    user,
                    subject,
                    module,
                    keep_chip,
                    other_chip,
                    group_a,
                    group_b,
                    study_a,
                    study_b,
                    question_a,
                    question_b,
                ]
            )
            db.commit()
            data = get_module_overview("module-1", chip_ids="chip-keep", db=db, current_user=user)
        finally:
            db.close()

        self.assertEqual([group.id for group in data["note_groups"]], ["group-a", "group-b"])
        stats_by_id = {group["id"]: group for group in data["note_group_stats"]}
        self.assertEqual(stats_by_id["group-a"]["study_count"], 1)
        self.assertEqual(stats_by_id["group-a"]["question_count"], 1)
        self.assertEqual(stats_by_id["group-a"]["due_count"], 1)
        self.assertEqual(stats_by_id["group-b"]["study_count"], 0)
        self.assertEqual(stats_by_id["group-b"]["question_count"], 0)
        self.assertEqual(data["module_stats"]["study_count"], 1)
        self.assertEqual(data["module_stats"]["question_count"], 1)
        self.assertEqual(data["module_stats"]["due_count"], 1)
        self.assertEqual(data["module_timeline"]["due"], 1)


if __name__ == "__main__":
    unittest.main()
