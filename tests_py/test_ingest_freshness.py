"""Unit tests for source freshness reporting."""

import unittest
from datetime import datetime, timedelta, timezone

from ingest.freshness import freshness_age_days, freshness_state


class FreshnessStateTests(unittest.TestCase):
    """Check timestamp classification and age reporting against a fixed clock."""

    def setUp(self):
        """Use a fixed UTC reference time for deterministic freshness checks."""
        self.now = datetime(2026, 10, 16, 12, 0, tzinfo=timezone.utc)

    def test_missing_timestamp_is_missing(self):
        """Classify an absent full-refresh timestamp as missing."""
        self.assertEqual(freshness_state(None, 14, now=self.now), "missing")

    def test_timestamp_inside_threshold_is_fresh(self):
        """Keep a refresh just inside the maximum age classified as fresh."""
        value = self.now - timedelta(days=13, hours=23)
        self.assertEqual(freshness_state(value, 14, now=self.now), "fresh")

    def test_timestamp_past_threshold_is_stale(self):
        """Classify a refresh older than the maximum age as stale."""
        value = self.now - timedelta(days=15)
        self.assertEqual(freshness_state(value, 14, now=self.now), "stale")

    def test_timestamp_far_in_future_is_flagged(self):
        """Flag timestamps beyond the allowed future clock skew."""
        value = self.now + timedelta(minutes=10)
        self.assertEqual(freshness_state(value, 14, now=self.now), "future")

    def test_naive_timestamp_is_treated_as_utc(self):
        """Interpret timestamps without timezone information as UTC."""
        value = datetime(2026, 10, 15, 12, 0)
        self.assertEqual(freshness_state(value, 14, now=self.now), "fresh")

    def test_age_for_missing_source_is_none(self):
        """Leave the age unknown when no refresh timestamp exists."""
        self.assertIsNone(freshness_age_days(None, now=self.now))

    def test_age_is_reported_in_days(self):
        """Report elapsed time in fractional days."""
        value = self.now - timedelta(days=1, hours=12)
        self.assertEqual(freshness_age_days(value, now=self.now), 1.5)

    def test_invalid_threshold_is_rejected(self):
        """Reject a nonpositive freshness threshold."""
        with self.assertRaises(ValueError):
            freshness_state(self.now, 0, now=self.now)


if __name__ == "__main__":
    unittest.main()
