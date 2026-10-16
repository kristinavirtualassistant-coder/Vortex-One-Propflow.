"""Tests for the public-record source coverage contract."""

import unittest

from ingest.sources import SOURCES


class SourceCoverageTests(unittest.TestCase):
    def test_la_source_defaults_to_the_existing_malibu_area_scope(self):
        source = SOURCES["la_parcels"]
        self.assertEqual(source["where"], "SitusCity LIKE 'MALIBU%'")
        self.assertIn("Malibu", source["coverage_scope"])
        self.assertIn("not countywide", source["coverage_scope"])

    def test_sf_source_scope_is_explicitly_limited_to_2022_onward(self):
        source = SOURCES["sf_roll"]
        self.assertEqual(source["where"], "closed_roll_year >= '2022'")
        self.assertIn("2022 onward", source["coverage_scope"])


if __name__ == "__main__":
    unittest.main()
