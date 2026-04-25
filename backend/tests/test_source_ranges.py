import unittest

from app.source_ranges import find_evidence_ranges


class SourceRangeTests(unittest.TestCase):
    def test_finds_all_repeated_exact_snippets(self):
        text = "Alpha explains beta.\n\nAlpha explains beta again.\n\nAlpha explains beta."

        ranges = find_evidence_ranges(text, ["Alpha explains beta"])

        self.assertEqual(ranges, [(0, 19), (22, 41), (50, 69)])

    def test_merges_overlapping_ranges(self):
        text = "The quick brown fox jumps."

        ranges = find_evidence_ranges(text, ["quick brown", "brown fox"])

        self.assertEqual(ranges, [(4, 19)])

    def test_ignores_unmatched_snippets(self):
        text = "Only this source exists."

        ranges = find_evidence_ranges(text, ["missing source"])

        self.assertEqual(ranges, [])


if __name__ == "__main__":
    unittest.main()
