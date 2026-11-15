"""Basic offline checks for regional gallery safety and completeness."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class GalleryTests(unittest.TestCase):
    def test_approved_seed_is_empty(self):
        approved = json.loads((ROOT / "photo-gallery-approved.json").read_text())
        self.assertEqual(approved["items"], [])

    def test_feed_contains_no_unapproved_images(self):
        feed = json.loads((ROOT / "photo-gallery-feed.json").read_text())
        self.assertTrue(all(item.get("approved") is True for item in feed["items"]))

    def test_four_regions_present_in_ui(self):
        js = (ROOT / "photo-gallery.js").read_text()
        for region in ("mauritius", "reunion", "rodrigues", "world"):
            self.assertIn(region, js)

    def test_candidate_discovery_never_auto_approves(self):
        script = (ROOT / "scripts/discover_photo_candidates.py").read_text()
        self.assertIn('"approved": False', script)
        self.assertIn('photo-gallery-candidates.json', script)

if __name__ == "__main__":
    unittest.main()
