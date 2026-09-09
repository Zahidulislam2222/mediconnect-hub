"""Trust only the reviewed build-tool package origin and immutable revision."""
from pathlib import Path
import copy
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_ios_gates import plugin_trust_entries


class PluginTrustTests(unittest.TestCase):
    def setUp(self):
        self.approved = [{"packageIdentity": "test-package", "targetName": "TestPlugin",
                          "fingerprint": "a" * 40, "location": "https://example.test/test-package"}]
        self.resolved = {"pins": [{"identity": "test-package", "location": "https://example.test/test-package.git",
                                   "state": {"revision": "a" * 40}}]}

    def test_exact_origin_and_revision_generate_one_scoped_entry(self):
        entries = plugin_trust_entries(self.resolved, self.approved)
        self.assertEqual(entries, [{key: self.approved[0][key] for key in ("packageIdentity", "targetName", "fingerprint")}])

    def test_changed_commit_requires_a_new_review(self):
        changed = copy.deepcopy(self.resolved)
        changed["pins"][0]["state"]["revision"] = "b" * 40
        with self.assertRaises(ValueError):
            plugin_trust_entries(changed, self.approved)

    def test_same_identity_from_different_origin_is_denied(self):
        changed = copy.deepcopy(self.resolved)
        changed["pins"][0]["location"] = "https://other.example.test/test-package"
        with self.assertRaises(ValueError):
            plugin_trust_entries(changed, self.approved)

    def test_absent_package_is_denied(self):
        with self.assertRaises(ValueError):
            plugin_trust_entries({"pins": []}, self.approved)


if __name__ == "__main__":
    unittest.main()
