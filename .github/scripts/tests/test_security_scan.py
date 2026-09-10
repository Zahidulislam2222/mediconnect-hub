"""Regression tests for security gate coverage and safe failure handling."""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "security_scan", Path(__file__).resolve().parents[1] / "security_scan.py")
SCAN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCAN)


class SecurityScanTests(unittest.TestCase):
    def test_real_bandit_scans_github_paths_in_snapshot(self):
        config_path = Path(__file__).resolve().parents[2] / "security-tools.json"
        config = json.loads(config_path.read_text())
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            (repo / ".github").mkdir()
            (repo / ".github/example.py").write_text("print('example')\n")
            with patch.object(SCAN, "git_output", return_value=b".github/example.py\0"):
                result = SCAN.scan(repo, "bandit", config)
            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["scanner_reported_files"], 1)

    def test_findings_fail_without_source_excerpts(self):
        result = SCAN.summarize("current-secrets", [{"Secret": "test-key"}], 1, 5)
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["findings"], 1)
        self.assertNotIn("test-key", json.dumps(result))

    def test_nonzero_exit_with_empty_report_fails(self):
        self.assertEqual(SCAN.summarize("history-secrets", [], 2, 3)["status"], "FAIL")

    def test_semgrep_partial_parse_error_fails(self):
        report = {"results": [], "errors": [{"message": "test-key"}],
                  "paths": {"scanned": ["example.ts"]}}
        result = SCAN.summarize("semgrep", report, 0, 1)
        self.assertEqual(result["status"], "FAIL")
        self.assertNotIn("test-key", json.dumps(result))

    def test_empty_semgrep_scope_fails(self):
        report = {"results": [], "errors": [], "paths": {"scanned": []}}
        self.assertEqual(SCAN.summarize("semgrep", report, 0, 5)["status"], "FAIL")

    def test_bandit_missing_file_fails(self):
        report = {"results": [], "errors": [], "metrics": {"_totals": {}, "one.py": {}}}
        self.assertEqual(SCAN.summarize("bandit", report, 0, 2)["status"], "FAIL")

    def test_invalid_gitleaks_report_fails(self):
        with self.assertRaises(ValueError):
            SCAN.summarize("current-secrets", {}, 0, 3)

    def test_malformed_semgrep_reports_fail(self):
        reports = [
            {"results": {}, "errors": {}, "paths": {"scanned": "fake.ts"}},
            {"results": [], "errors": [], "paths": {"scanned": "fake.ts"}},
            {"results": [], "errors": [], "paths": {"scanned": ["a.ts", "a.ts"]}},
            {"results": [], "errors": [], "paths": {"scanned": ["a.ts"], "skipped": {}}},
        ]
        for report in reports:
            with self.subTest(report=report), self.assertRaises(ValueError):
                SCAN.summarize("semgrep", report, 0, 1)

    def test_malformed_bandit_reports_fail(self):
        reports = [
            {"results": "", "errors": {}, "metrics": {"_totals": None, "fake.py": None}},
            {"results": [], "errors": [], "metrics": {"_totals": {}, "fake.py": None}},
        ]
        for report in reports:
            with self.subTest(report=report), self.assertRaises(ValueError):
                SCAN.summarize("bandit", report, 0, 1)

    def test_gitleaks_policy_files_are_rejected(self):
        for name in (".gitleaksignore", ".gitleaks.toml"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                repo = Path(directory)
                (repo / name).write_text("test policy")
                with self.assertRaises(RuntimeError):
                    SCAN.reject_secret_suppressions(repo)

    def test_gitleaks_environment_policy_is_rejected(self):
        for name in ("GITLEAKS_CONFIG", "GITLEAKS_CONFIG_TOML"):
            with self.subTest(name=name), patch.dict(os.environ, {name: "test policy"}):
                with self.assertRaises(RuntimeError):
                    SCAN.reject_secret_suppressions(Path.cwd())

    def test_snapshot_includes_tracked_tests_but_not_private_files(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / "repo"
            repo.mkdir()
            (repo / "tests").mkdir()
            (repo / "tests/example.py").write_text("print('example')")
            (repo / ".env.local").write_text("EXAMPLE=test-key")
            target = Path(directory) / "snapshot"
            with patch.object(SCAN, "git_output", return_value=b"tests/example.py\0"):
                names = SCAN.snapshot(repo, target, 10)
            self.assertEqual(names, ["tests/example.py"])
            self.assertTrue((target / "tests/example.py").is_file())
            self.assertFalse((target / ".env.local").exists())

    def test_empty_inventory_fails(self):
        with patch.object(SCAN, "git_output", return_value=b""):
            with self.assertRaises(RuntimeError):
                SCAN.snapshot(Path.cwd(), Path.cwd(), 10)

    def test_missing_tracked_file_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(SCAN, "git_output", return_value=b"missing.py\0"):
                with self.assertRaises(RuntimeError):
                    SCAN.snapshot(Path(directory), Path(directory) / "out", 10)

    def test_exception_output_is_redacted(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            (repo / ".github").mkdir()
            (repo / ".github/security-tools.json").write_text("{}")
            output = io.StringIO()
            with patch("sys.argv", ["scan", "semgrep", "--repo", str(repo)]):
                with patch.object(SCAN, "scan", side_effect=RuntimeError("test-key")):
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(SCAN.main(), 1)
            self.assertNotIn("test-key", output.getvalue())
            self.assertEqual(json.loads(output.getvalue())["status"], "ERROR")


if __name__ == "__main__":
    unittest.main()
