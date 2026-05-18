import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Module, NoteGroup, Subject


class PageRoutesTests(unittest.TestCase):
    def test_frontend_uses_durable_subject_and_module_urls(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("/app/subjects/", content)
        self.assertIn("/app/modules/", content)
        self.assertIn("create-note-group", content)
        self.assertIn("/app/note-groups/${noteGroupId}/${panel}", content)
        self.assertIn("overview|study-cards|question-cards", content)
        self.assertIn("routeSubjectId", content)
        self.assertIn("routeModuleId", content)

    def test_backend_exposes_module_lookup_for_url_restoration(self):
        from app.main import app

        routes = {
            (route.path, ",".join(sorted(route.methods or [])))
            for route in app.routes
            if hasattr(route, "methods")
        }

        self.assertIn(("/modules/{module_id}", "GET"), routes)

    def test_note_group_lookup_includes_subject_id_for_deep_link_restoration(self):
        from app.main import get_note_group

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        db = TestingSessionLocal()
        try:
            subject = Subject(id="subject-1", title="Subject")
            module = Module(id="module-1", subject_id=subject.id, title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id=module.id,
                title="Note group",
                raw_text="Raw text",
            )
            db.add_all([subject, module, note_group])
            db.commit()

            result = get_note_group("note-group-1", db=db)
            self.assertEqual(result.subject_id, "subject-1")
        finally:
            db.close()

    def test_module_overview_fetch_is_not_keyed_to_note_group_url_changes(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("[selectedModuleId, chipFilterIds, reviewRefreshToken]", content)
        self.assertNotIn(
            "[selectedModuleId, chipFilterIds, reviewRefreshToken, routeNoteGroupId]",
            content,
        )

    def test_deep_link_refresh_waits_for_route_restoration(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("isRestoringRoute", content)
        self.assertIn("routeRestoreError", content)
        self.assertIn("Unable to restore page", content)
        self.assertIn("withRouteRestoreTimeout", content)
        self.assertIn("restoreNoteGroupRoute", content)
        self.assertIn("getNoteGroup(routeNoteGroupId)", content)
        self.assertIn("routeNoteGroupRestoredFromList", content)
        self.assertIn("group.id === routeNoteGroupId", content)
        self.assertIn("Restoring page", content)
        self.assertIn("!isRestoringRoute && !selectedSubjectId", content)

    def test_note_group_refresh_can_restore_from_existing_modules_list(self):
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"

        self.assertIn("export function listAllModules()", api_source.read_text(encoding="utf-8"))
        app_content = app_source.read_text(encoding="utf-8")
        self.assertIn("await resolveModuleForRouteRestore", app_content)
        self.assertIn("listAllModules", app_content)


if __name__ == "__main__":
    unittest.main()
