import unittest
from pathlib import Path


class UniqueIdCreationUiTests(unittest.TestCase):
    def test_note_group_creation_has_raw_text_help_and_optional_parameters(self):
        create_source = (
            Path(__file__).parents[2]
            / "frontend"
            / "src"
            / "features"
            / "note-groups"
            / "NoteGroupCreate.jsx"
        )
        styles_source = Path(__file__).parents[2] / "frontend" / "src" / "styles.css"
        content = create_source.read_text(encoding="utf-8")
        styles = styles_source.read_text(encoding="utf-8")

        self.assertIn("Raw Text", content)
        self.assertIn("Optional parameters", content)
        self.assertIn("<details", content)
        self.assertIn("optional-parameters", styles)
        self.assertIn("z-index", styles)


if __name__ == "__main__":
    unittest.main()
