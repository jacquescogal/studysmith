import unittest


class NoteGroupCreationRoutesTests(unittest.TestCase):
    def test_only_auto_workflow_creation_route_is_exposed(self):
        from app.main import app

        routes = {
            (route.path, ",".join(sorted(route.methods or [])))
            for route in app.routes
            if hasattr(route, "methods")
        }

        self.assertIn(("/note-groups/auto", "POST"), routes)
        self.assertNotIn(("/note-groups/title-suggestions", "POST"), routes)
        self.assertNotIn(("/note-groups/topic-chips/suggest", "POST"), routes)
        self.assertNotIn(("/note-groups/finalize", "POST"), routes)
        self.assertNotIn(("/modules/{module_id}/note-groups", "POST"), routes)
        self.assertNotIn(("/note-groups/{note_group_id}/generate", "POST"), routes)


if __name__ == "__main__":
    unittest.main()
