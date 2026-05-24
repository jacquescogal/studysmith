import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Module, NoteGroup, Subject, User


class PageRoutesTests(unittest.TestCase):
    def test_frontend_uses_durable_subject_and_module_urls(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        routes_source = Path(__file__).parents[2] / "frontend" / "src" / "lib" / "routes.js"
        content = app_source.read_text(encoding="utf-8")
        api_content = api_source.read_text(encoding="utf-8")
        routes_content = routes_source.read_text(encoding="utf-8")

        self.assertIn("/app/subject/", routes_content)
        self.assertIn("/module/", routes_content)
        self.assertIn("create-note-group", routes_content)
        self.assertIn(
            "/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}",
            routes_content,
        )
        self.assertIn(
            "/app/subject/${subjectCode}/module/${moduleCode}/topics/${topicCode}",
            routes_content,
        )
        self.assertIn("overview|view-cards|study-cards|question-cards", routes_content)
        self.assertIn(
            "topics/${topicCode}`;\n  return panel && panel !== \"overview\" ? `${basePath}/${panel}`",
            routes_content,
        )
        topic_route = routes_content[
            routes_content.index("const topic ="):routes_content.index("return {")
        ]
        self.assertIn("view-cards", topic_route)
        self.assertIn("routeSubjectCode", content)
        self.assertIn("routeModuleCode", content)
        self.assertIn("routeNoteGroupCode", content)
        self.assertIn("routeTopicCode", content)
        self.assertIn("resolveAppNoteGroupRoute", content)
        self.assertIn("resolveAppTopicRoute", content)
        self.assertIn("/routes/app/subject/${subjectCode}", api_content)
        self.assertIn("subject.short_code", content)
        self.assertIn("module.short_code", content)
        self.assertIn("noteGroup?.short_code", content)
        self.assertIn("topic.short_code", content)
        self.assertNotIn("/app/subjects/", routes_content)
        self.assertNotIn("/app/modules/", routes_content)
        self.assertNotIn("/app/note-groups/", routes_content)

    def test_frontend_exposes_note_group_view_cards_page(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        routes_source = Path(__file__).parents[2] / "frontend" / "src" / "lib" / "routes.js"

        content = app_source.read_text(encoding="utf-8")
        api_content = api_source.read_text(encoding="utf-8")
        routes_content = routes_source.read_text(encoding="utf-8")

        self.assertIn("view-cards", routes_content)
        self.assertIn("getNoteGroupCardTable", api_content)
        self.assertIn("/note-groups/${noteGroupId}/card-table", api_content)
        self.assertIn("NoteGroupViewCards", content)
        self.assertIn("isViewCardsPage", content)

    def test_view_cards_opens_study_card_details_modal_from_study_card_cell(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("Search", content)
        self.assertIn("Dialog", content)
        self.assertIn("selectedStudyCardId", content)
        self.assertIn("aria-label=\"View Study Card details\"", content)
        self.assertIn("Edit", content)
        self.assertIn("Delete", content)
        self.assertNotIn("<TableHead>Actions</TableHead>", content)

    def test_view_cards_edit_modal_uses_single_editable_title_surface(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("isEditingSelected ? \"Edit Study Card\" : selectedTitle", content)
        self.assertIn("aria-label=\"Study Card title\"", content)

    def test_view_cards_opens_question_card_details_modal_from_question_card_cell(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("selectedQuestionCardId", content)
        self.assertIn("aria-label=\"View Question Card details\"", content)
        self.assertIn("Edit Question Card", content)
        self.assertIn("onEditQuestionCard", content)
        self.assertIn("onDeleteQuestionCard", content)
        self.assertIn("correct_option_indices", content)

    def test_view_cards_table_shows_question_card_learning_metrics(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("Mastery", content)
        self.assertIn("Success Rate", content)
        self.assertIn("Median Time", content)
        self.assertIn("Reviews", content)
        self.assertIn("Due", content)
        self.assertIn("formatDurationMs", content)
        self.assertIn("formatPercent", content)

    def test_view_cards_table_supports_filtering_and_sorting(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("masteryFilter", content)
        self.assertIn("reviewedFilter", content)
        self.assertIn("dueFilter", content)
        self.assertIn("searchQuery", content)
        self.assertIn("sortConfig", content)
        self.assertIn("toggleSort", content)
        self.assertIn("filteredRows", content)
        self.assertIn("All mastery", content)
        self.assertIn("Reviewed", content)
        self.assertIn("Due now", content)
        self.assertIn("Search cards", content)

    def test_view_cards_table_supports_multi_select_study_card_topic_filtering(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        content = component_source.read_text(encoding="utf-8")

        self.assertIn("selectedTopicFilters", content)
        self.assertIn("toggleTopicFilter", content)
        self.assertIn("All topics", content)
        self.assertIn("studyTopicIds", content)
        self.assertIn("activeTopicFilters.length === 0", content)
        self.assertIn("activeTopicFilters.some", content)
        self.assertIn("setSelectedTopicFilters([])", content)
        self.assertIn("buttonVariants", content)
        self.assertNotIn("<PopoverTrigger asChild>", content)

    def test_topic_view_cards_uses_fixed_topic_filter(self):
        component_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupViewCards.jsx"
        )
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        component_content = component_source.read_text(encoding="utf-8")
        app_content = app_source.read_text(encoding="utf-8")

        self.assertIn("fixedTopicFilter", component_content)
        self.assertIn("activeTopicFilters", component_content)
        self.assertIn("isTopicFilterFixed", component_content)
        self.assertIn("Fixed topic", component_content)
        self.assertIn("!isTopicFilterFixed", component_content)
        self.assertIn("fixedTopicFilter={isTopicScope ? selectedTopic : null}", app_content)

    def test_view_cards_page_does_not_show_section_navigator(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("selectedNoteGroupId && !selectedTopicId && isViewCardsPage", content)
        self.assertNotIn('return [{ id: "view-cards", label: "View cards" }];', content)

    def test_note_group_overview_content_card_is_primary_card_entry_point(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        overview_index = content.index("<NoteGroupOverview")
        content_index = content.index('id="note-group-content"')
        progress_index = content.index("<NoteGroupProgress")
        self.assertLess(overview_index, content_index)
        self.assertLess(content_index, progress_index)

        content_section = content[content_index:content.index("</section>", content_index)]
        self.assertIn("View Cards", content_section)
        self.assertIn("View Source", content_section)
        self.assertNotIn("View Study Cards", content_section)
        self.assertNotIn("View Question Cards", content_section)
        progress_details = content[
            content.index("onOpenPerformance", progress_index):content.index("/>", progress_index)
        ]
        self.assertIn('"view-cards"', progress_details)
        self.assertNotIn('"question-cards"', progress_details)

    def test_topic_overview_uses_view_cards_as_card_entry_point(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        topic_index = content.index("<TopicOverview")
        topic_actions = content[content.index("actions={", topic_index):content.index("error={topicError}", topic_index)]
        self.assertIn('"view-cards"', topic_actions)
        self.assertIn("View cards", topic_actions)
        self.assertNotIn('"study-cards"', topic_actions)
        self.assertNotIn('"question-cards"', topic_actions)
        self.assertNotIn("View study cards", topic_actions)
        self.assertNotIn("View question cards", topic_actions)
        self.assertIn("topicCardTableRows", content)

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
            user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=user.id)
            module = Module(id="module-1", subject_id=subject.id, title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id=module.id,
                title="Note group",
                raw_text="Raw text",
            )
            db.add_all([user, subject, module, note_group])
            db.commit()

            result = get_note_group("note-group-1", db=db, current_user=user)
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
        self.assertIn("routeTopicRestoredFromList", content)
        self.assertIn("group.id === routeNoteGroupId", content)
        self.assertIn("topic.id === routeTopicId", content)
        self.assertIn("Fetching page", content)
        self.assertNotIn("Restoring page", content)
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
        self.assertIn("resolveAppTopicRoute(routeSubjectCode", app_content)
        self.assertIn("setSelectedNoteGroupId(context.note_group_id)", app_content)
        self.assertIn("setSelectedTopicId(context.topic_id)", app_content)
        self.assertIn("|routes", vite_config.read_text(encoding="utf-8"))
        self.assertIn("|topics", vite_config.read_text(encoding="utf-8"))

    def test_route_restore_waits_for_auth_session_restore(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("isAuthReadyForRouteRestore", content)
        self.assertGreaterEqual(
            content.count("if (!isAuthReadyForRouteRestore(auth))"),
            4,
        )

    def test_panel_navigation_keeps_resolved_route_context(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertNotIn("}, [location.pathname]);", content)
        self.assertIn(
            "}, [routeSubjectCode, routeModuleCode, routeNoteGroupCode, routeTopicCode, routeCreateNoteGroup]);",
            content,
        )

    def test_frontend_presents_topics_as_first_class_sidebar_scope(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        api_source = Path(__file__).parents[2] / "frontend" / "src" / "api.js"
        content = app_source.read_text(encoding="utf-8")
        api_content = api_source.read_text(encoding="utf-8")

        self.assertIn('sidebarScope, setSidebarScope] = useState("note-groups")', content)
        self.assertIn("Topics", content)
        self.assertIn("selectedTopicId", content)
        self.assertIn("handleSelectTopic", content)
        self.assertIn("updateTopic", api_content)
        self.assertIn("deleteTopic", api_content)
        self.assertIn("listTopicStudyCards", api_content)
        self.assertIn("listTopicQuestionCards", api_content)
        self.assertNotIn("adjust topic chips for this note group", content)
        self.assertNotIn("Search and assign topic chips", content)
        self.assertNotIn("New topic chip", content)

    def test_sidebar_background_fetch_errors_use_toasts(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("showFetchToast", content)
        self.assertIn('showFetchToast(error, "Failed to load note groups")', content)
        self.assertIn('showFetchToast(error, "Failed to load topics")', content)
        self.assertNotIn('setSidebarError(error.message || "Failed to load note groups")', content)
        self.assertNotIn('setSidebarError(error.message || "Failed to load module due counts")', content)
        self.assertNotIn(".catch((error) => setSidebarError(error.message));", content)


if __name__ == "__main__":
    unittest.main()
