"""The security workflow must propagate every scanner gate's failure."""

from pathlib import Path
import re
import unittest


WORKFLOW = Path(__file__).resolve().parents[2] / "workflows/security.yml"


class SecurityWorkflowPolicyTests(unittest.TestCase):
    def test_scanner_failures_remain_blocking(self):
        content = WORKFLOW.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"^\s*continue-on-error\s*:", content, re.MULTILINE),
            "Security scan failures must fail CI, including historical findings.",
        )

    def test_all_scanner_modes_remain_in_the_matrix(self):
        content = WORKFLOW.read_text(encoding="utf-8")
        matrix = re.search(r"^\s*gate:\s*\[([^\]]+)\]", content, re.MULTILINE)
        self.assertIsNotNone(matrix, "The scanner matrix must be explicit.")
        self.assertEqual(
            {item.strip() for item in matrix.group(1).split(",")},
            {"current-secrets", "history-secrets", "semgrep", "bandit"},
        )


if __name__ == "__main__":
    unittest.main()
