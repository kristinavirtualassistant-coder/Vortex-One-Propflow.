"""Unit tests for the ingestion freshness guards."""

import unittest

from ingest.guards import is_complete_refresh, positive_int


class CompleteRefreshTests(unittest.TestCase):
    """Check refresh completeness rules and positive row-limit validation."""

    def test_unlimited_configured_source_scope_is_complete(self):
        """Treat an unrestricted load of the configured scope as complete."""
        self.assertTrue(is_complete_refresh())

    def test_limited_load_is_partial(self):
        """Treat a load with a row limit as partial."""
        self.assertFalse(is_complete_refresh(limit=5000))

    def test_missing_source_keys_make_refresh_incomplete(self):
        """Prevent skipped source keys from qualifying as a full refresh."""
        self.assertFalse(is_complete_refresh(skipped_keys=1))

    def test_explicit_filter_override_is_partial(self):
        """Treat an explicit source-filter override as partial."""
        self.assertFalse(is_complete_refresh(where="SitusCity LIKE 'MALIBU%'"))

    def test_limit_and_filter_are_both_partial(self):
        """Keep a load partial when both a limit and filter are supplied."""
        self.assertFalse(is_complete_refresh(limit=5, where="county = 'x'"))

    def test_empty_filter_is_not_a_scope_override(self):
        """Allow a whitespace-only filter without narrowing the source scope."""
        self.assertTrue(is_complete_refresh(where="   "))

    def test_positive_limit_is_accepted(self):
        """Convert a positive row-limit argument to an integer."""
        self.assertEqual(positive_int("5000"), 5000)

    def test_zero_limit_is_rejected(self):
        """Reject zero as a row-limit argument."""
        with self.assertRaises(ValueError):
            positive_int("0")

    def test_negative_limit_is_rejected(self):
        """Reject a negative row-limit argument."""
        with self.assertRaises(ValueError):
            positive_int("-10")


if __name__ == "__main__":
    unittest.main()
