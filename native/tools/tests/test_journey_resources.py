"""Prove native resource packaging shares approved assets without private files."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("prepare_resources", Path(__file__).resolve().parents[1] / "prepare_ios_resources.py")
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)


class JourneyResourceTests(unittest.TestCase):
    def test_canonical_journey_and_media_are_copied_without_private_files(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "Resources"
            with patch.object(PREPARE, "OUTPUT", output):
                PREPARE.main()
            hub = PREPARE.NATIVE.parent
            self.assertEqual((hub / "src/content/journey.json").read_bytes(), (output / "journey.json").read_bytes())
            document = json.loads((output / "journey.json").read_text())
            for key in ("poster", "homePoster"):
                asset = document["media"][key]
                expected = (hub / "public" / asset.lstrip("/")).read_bytes()
                self.assertGreater(len(expected), 0)
                self.assertEqual(expected, (output / Path(asset).name).read_bytes())
            self.assertFalse((output / "CREDENTIALS.md").exists())
            self.assertFalse((output / "memory").exists())
            allowed = {"mobile-content.json", "mobile-contract.json", "mobile-config.example.json", "mobile-config.json",
                       "session-policy.json", "legal.json", "consent.json", "journey.json"}
            allowed.update(Path(document["media"][key]).name for key in ("poster", "homePoster"))
            self.assertEqual({p.name for p in output.iterdir()}, allowed)


if __name__ == "__main__":
    unittest.main()
