"""Run independent security gates without publishing scanner source excerpts."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


MODES = ("current-secrets", "history-secrets", "semgrep", "bandit")


def reject_secret_suppressions(repo):
    if any(name in os.environ for name in ("GITLEAKS_CONFIG", "GITLEAKS_CONFIG_TOML")):
        raise RuntimeError("Review Gitleaks environment policy before scanning")
    if any((repo / name).exists() for name in (".gitleaks.toml", ".gitleaksignore")):
        raise RuntimeError("Review Gitleaks ignore policy before scanning")


def object_list(value):
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError("Invalid scanner result list")
    return value


def execute(command, cwd, timeout):
    return subprocess.run(command, cwd=cwd, capture_output=True, timeout=timeout,
                          check=False)


def git_output(repo, arguments, timeout):
    result = execute(["git", *arguments], repo, timeout)
    if result.returncode:
        raise RuntimeError("Git inventory failed")
    return result.stdout


def snapshot(repo, destination, timeout):
    names = git_output(repo, ["ls-files", "-z"], timeout).decode().split("\0")
    names = sorted(set(name for name in names if name))
    if not names:
        raise RuntimeError("Empty tracked-source inventory")
    for name in names:
        source = repo / name
        if source.is_symlink() or not source.is_file():
            raise RuntimeError("Tracked source must be an existing regular file")
        if not source.resolve().is_relative_to(repo.resolve()):
            raise RuntimeError("Tracked source escapes repository")
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    return names


def summarize(mode, report, exit_code, targets):
    """Only counts leave this boundary; reports can contain sensitive source."""
    if mode.endswith("secrets"):
        findings, errors, scanned = len(object_list(report)), 0, None
    elif mode == "semgrep":
        findings = len(object_list(report["results"]))
        errors = len(object_list(report["errors"]))
        paths = report["paths"]["scanned"]
        if not isinstance(paths, list) or any(not isinstance(path, str) or not path for path in paths):
            raise ValueError("Invalid scanned paths")
        if len(set(paths)) != len(paths):
            raise ValueError("Duplicate scanned paths")
        scanned = len(paths)
        if not scanned:
            errors += 1
    else:
        findings = len(object_list(report["results"]))
        errors = len(object_list(report["errors"]))
        metrics = report["metrics"]
        if not isinstance(metrics, dict) or "_totals" not in metrics:
            raise ValueError("Invalid Bandit metrics")
        if any(not isinstance(value, dict) for value in metrics.values()):
            raise ValueError("Invalid Bandit file metrics")
        scanned = len([key for key in metrics if key != "_totals"])
        if scanned != targets:
            errors += 1
    passed = exit_code == 0 and findings == 0 and errors == 0
    summary = {"gate": mode, "status": "PASS" if passed else "FAIL",
            "targets_submitted": targets, "scanner_reported_files": scanned,
            "findings": findings, "scanner_errors": errors,
            "scanner_exit": exit_code}
    if mode == "semgrep":
        skipped = report["paths"].get("skipped")
        summary["scanner_reported_skips"] = None if skipped is None else len(object_list(skipped))
    return summary


def scan(repo, mode, config):
    timeout = config["command_timeout_seconds"]
    with tempfile.TemporaryDirectory(prefix="mediconnect-security-") as temporary:
        work = Path(temporary)
        source = work / "source"
        source.mkdir()
        names = snapshot(repo, source, timeout)
        report_path = work / "report.json"
        cwd = source
        targets = len(names)
        if mode.endswith("secrets"):
            reject_secret_suppressions(repo)
            command = ["gitleaks", "git" if mode == "history-secrets" else "dir",
                       "--redact=100", "--no-banner", "--ignore-gitleaks-allow",
                       "--report-format=json", "--report-path=" + str(report_path)]
            if mode == "history-secrets":
                if git_output(repo, ["rev-parse", "--is-shallow-repository"], timeout).strip() != b"false":
                    raise RuntimeError("Full history requires a non-shallow checkout")
                targets = int(git_output(repo, ["rev-list", "--all", "--count"], timeout))
                if not targets:
                    raise RuntimeError("Empty history")
                command.append("--log-opts=--all")
                cwd = repo
            command.append(".")
        elif mode == "semgrep":
            # An empty file disables Semgrep's built-in test/vendor exclusions.
            # Never overwrite an existing policy that could hide source.
            if any(source.rglob(".semgrepignore")):
                raise RuntimeError("Review Semgrep ignore policy before scanning")
            (source / ".semgrepignore").write_text("", encoding="utf-8")
            command = ["semgrep", "scan", "--config=" + config["semgrep_rules"],
                       "--metrics=off", "--disable-version-check", "--disable-nosem",
                       "--no-git-ignore", "--strict", "--error", "--json", "--verbose",
                       "--max-target-bytes=0",
                       "--output=" + str(report_path), "."]
        else:
            python_files = [name for name in names if Path(name).suffix == ".py"]
            targets = len(python_files)
            if not targets:
                return {"gate": mode, "status": "NOT_APPLICABLE",
                        "targets_submitted": 0, "reason": "No tracked Python files"}
            # Explicit tracked files need no path exclusions. Bandit's default
            # '.git' substring exclusion otherwise also skips '.github' when
            # the snapshot has no .git directory.
            if (source / ".bandit").exists():
                raise RuntimeError("Review Bandit policy before scanning")
            command = ["bandit", "-ll", "--exclude=", "--ignore-nosec", "--format=json",
                       "--output=" + str(report_path), *python_files]
        result = execute(command, cwd, timeout)
        report = json.loads(report_path.read_text(encoding="utf-8"))
        summary = summarize(mode, report, result.returncode, targets)
        summary["target_unit"] = "commits" if mode == "history-secrets" else "files"
        return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gate", choices=MODES)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    try:
        config = json.loads((args.repo / ".github/security-tools.json").read_text())
        result = scan(args.repo.resolve(), args.gate, config)
    except Exception as error:
        # Exception messages and scanner stderr may contain secrets or source.
        result = {"gate": args.gate, "status": "ERROR", "error_type": type(error).__name__}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] in {"PASS", "NOT_APPLICABLE"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
