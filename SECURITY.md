# Security verification

The security workflow has four independent gates:

| Gate | Scope | Failure conditions |
| --- | --- | --- |
| Current secrets | Current contents of every tracked regular file | Gitleaks findings or execution/report errors |
| Historical secrets | All commits reachable from the fetched refs | Gitleaks findings, shallow history or execution/report errors |
| Semgrep | Tracked source snapshot, including tests | Security-audit findings, reported scanner/parse errors or an empty scan |
| Bandit | Every tracked Python file | Medium/high severity findings, scanner errors or incomplete file coverage |

The runner reports submitted targets separately from scanner-reported file counts.
Gitleaks does not report a parsed-file count in its JSON report; that field is null.
Semgrep rules support selected languages and syntax, so its scanned-file count is
not proof that every file or behavior has security-rule coverage. An empty
Semgrep ignore file in the temporary snapshot disables its built-in path exclusions;
Git-ignored local configuration never enters the tracked-source snapshot.
Semgrep's file-size exclusion is disabled and reported skip counts are included.
Bandit scans the explicit Python inventory with no path exclusions; its default
`.git` substring exclusion would otherwise also exclude `.github` in a snapshot.
Unreviewed Gitleaks configuration/ignore files and environment overrides,
Semgrep ignore files, and Bandit policy files are rejected instead of silently
applying a potentially suppressing policy.

Tool versions and the verified Linux Gitleaks archive checksum live in
`.github/security-tools.json`. The Semgrep community ruleset is fetched from the
registry on each run and can change independently of the pinned engine version.
The workflow uses read-only checkout permissions, a standard public-repository
runner, and no paid model API. Repository branch protection must be configured
separately; a workflow alone does not prove that merges are blocked.

Run the same gates locally after installing the configured versions:

```bash
python3 -m unittest discover -s .github/scripts/tests -v
python3 .github/scripts/security_scan.py current-secrets
python3 .github/scripts/security_scan.py history-secrets
python3 .github/scripts/security_scan.py semgrep
python3 .github/scripts/security_scan.py bandit
```

New files must be added to Git before running these checks. The runner reads the
current working contents of tracked files, not ignored secrets or build output.
Use a full clone for the history gate. Scanner errors and findings produce a
nonzero exit status. Raw scanner output and source excerpts stay in temporary
local files and are never uploaded as CI artifacts; public output contains counts
only. Reproduce a failing scan privately to inspect its detailed findings.

Historical detections remain an open gate until investigated and remediated.
Passing current-source checks does not establish clean history, valid credential
restrictions, runtime authorization, dependency safety or production readiness.
Do not add exclusions, baselines, inline suppressions or successful exit overrides
to conceal findings. Report suspected exposed credentials privately to the project
owner without posting their values in issues or pull requests.
