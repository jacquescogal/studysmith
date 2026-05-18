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
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        content = app_source.read_text(encoding="utf-8")
        api_content = api_source.read_text(encoding="utf-8")

        self.assertIn("/app/subject/", content)
        self.assertIn("/module/", content)
        self.assertIn("create-note-group", content)
        self.assertIn(
            "/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}",
            content,
        )
        self.assertIn("overview|study-cards|question-cards", content)
        self.assertIn("routeSubjectCode", content)
        self.assertIn("routeModuleCode", content)
        self.assertIn("routeNoteGroupCode", content)
        self.assertIn("resolveAppNoteGroupRoute", content)
        self.assertIn("/routes/app/subject/${subjectCode}", api_content)
        self.assertIn("subject.short_code", content)
        self.assertIn("module.short_code", content)
        self.assertIn("noteGroup?.short_code", content)
        self.assertNotIn("/app/subjects/", content)
        self.assertNotIn("/app/modules/", content)
        self.assertNotIn("/app/note-groups/", content)

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
        self.assertIn("resolveAppNoteGroupRoute", content)
        self.assertIn("routeNoteGroupRestoredFromList", content)
        self.assertIn("group.id === routeNoteGroupId", content)
        self.assertIn("Restoring page", content)
        self.assertIn("!isRestoringRoute && !selectedSubjectId", content)

    def test_note_group_refresh_uses_route_resolver(self):
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        vite_config = Path(__file__).parents[2] / "frontend" / "vite.config.js"

        self.assertIn(
            "export function resolveAppNoteGroupRoute",
            api_source.read_text(encoding="utf-8"),
        )
        app_content = app_source.read_text(encoding="utf-8")
        self.assertIn("resolveAppNoteGroupRoute(routeSubjectCode", app_content)
        self.assertIn("setSelectedNoteGroupId(context.note_group_id)", app_content)
        self.assertIn("|routes", vite_config.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
