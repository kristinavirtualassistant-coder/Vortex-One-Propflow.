"""Unit tests for the ingestion freshness guards."""

import unittest

from ingest.guards import is_complete_refresh, positive_int


class CompleteRefreshTests(unittest.TestCase):
    def test_unlimited_configured_source_scope_is_complete(self):
        self.assertTrue(is_complete_refresh())

    def test_limited_load_is_partial(self):
        self.assertFalse(is_complete_refresh(limit=5000))

    def test_explicit_filter_override_is_partial(self):
        self.assertFalse(is_complete_refresh(where="SitusCity LIKE 'MALIBU%'"))

    def test_limit_and_filter_are_both_partial(self):
        self.assertFalse(is_complete_refresh(limit=5, where="county = 'x'"))

    def test_empty_filter_is_not_a_scope_override(self):
        self.assertTrue(is_complete_refresh(where="   "))

    def test_positive_limit_is_accepted(self):
        self.assertEqual(positive_int("5000"), 5000)

    def test_zero_limit_is_rejected(self):
        with self.assertRaises(ValueError):
            positive_int("0")

    def test_negative_limit_is_rejected(self):
        with self.assertRaises(ValueError):
            positive_int("-10")


if __name__ == "__main__":
    unittest.main()
