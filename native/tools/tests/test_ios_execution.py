"""Exercise complete regional gate dispatch and failure propagation without a Mac."""
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_ios_gates import run_schemes


class IOSExecutionTests(unittest.TestCase):
    def settings(self, parallel=False):
        return {"iosSchemes": ["Test-US", "Test-EU"], "gateTimeoutSeconds": 2,
                "iosParallelTesting": parallel}

    @patch("run_ios_gates.subprocess.run")
    def test_all_regional_suites_run_serially_with_validation_intact(self, execute):
        run_schemes(Path("Test.xcodeproj"), Path("TestData"), "test-destination", self.settings())
        self.assertEqual(execute.call_count, 2)
        for call, scheme in zip(execute.call_args_list, self.settings()["iosSchemes"]):
            command = call.args[0]
            self.assertEqual(command[command.index("-scheme") + 1], scheme)
            self.assertEqual(command[command.index("-parallel-testing-enabled") + 1], "NO")
            self.assertIn("CODE_SIGNING_ALLOWED=NO", command)
            self.assertEqual(command[-1], "test")
            self.assertFalse(any("skip" in argument or "retry" in argument for argument in command))
            self.assertTrue(call.kwargs["check"])
            self.assertEqual(call.kwargs["timeout"], 2)

    @patch("run_ios_gates.subprocess.run")
    def test_parallel_mode_is_owned_by_configuration(self, execute):
        run_schemes(Path("Test.xcodeproj"), Path("TestData"), "test-destination", self.settings(True))
        command = execute.call_args.args[0]
        self.assertEqual(command[command.index("-parallel-testing-enabled") + 1], "YES")

    @patch("run_ios_gates.subprocess.run", side_effect=subprocess.CalledProcessError(65, "test"))
    def test_test_failure_propagates_without_retry_or_false_success(self, execute):
        with self.assertRaises(subprocess.CalledProcessError):
            run_schemes(Path("Test.xcodeproj"), Path("TestData"), "test-destination", self.settings())
        self.assertEqual(execute.call_count, 1)

    @patch("run_ios_gates.subprocess.run")
    def test_invalid_mode_fails_before_starting_a_build(self, execute):
        with self.assertRaises(ValueError):
            run_schemes(Path("Test.xcodeproj"), Path("TestData"), "test-destination", self.settings("false"))
        execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
