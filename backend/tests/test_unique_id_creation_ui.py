import unittest
from pathlib import Path


class UniqueIdCreationUiTests(unittest.TestCase):
    def test_note_group_creation_uses_unique_id_language_and_uuid_button(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        content = app_source.read_text(encoding="utf-8")

        self.assertIn("Unique ID", content)
        self.assertIn("Use generated ID", content)
        self.assertIn("randomUUID", content)

    def test_note_group_creation_has_raw_text_help_and_optional_parameters(self):
        app_source = Path(__file__).parents[2] / "frontend" / "src" / "App.jsx"
        styles_source = Path(__file__).parents[2] / "frontend" / "src" / "styles.css"
        content = app_source.read_text(encoding="utf-8")
        styles = styles_source.read_text(encoding="utf-8")

        self.assertIn("Raw text help", content)
        self.assertIn("Optional parameters", content)
        self.assertIn("<details", content)
        self.assertIn("#create-note-group", styles)
        self.assertIn("z-index", styles)


if __name__ == "__main__":
    unittest.main()
