"""Regression checks for native configuration/content boundaries and obvious secret material."""
from pathlib import Path
import json
import re

NATIVE = Path(__file__).resolve().parents[1]
HUB = NATIVE.parent


def read(name):
    return json.loads((NATIVE / "shared" / name).read_text(encoding="utf-8"))


def main():
    config = read("mobile-config.example.json")
    assert set(config) == {"requestTimeoutSeconds", "maxResponseBytes", "regions"}
    assert config["requestTimeoutSeconds"] > 0 and config["maxResponseBytes"] > 0
    assert set(config["regions"]) == {"US", "EU"}
    for region in config["regions"].values():
        assert set(region) == {"awsRegion", "userPoolId", "clientId", "issuer", "services"}
        assert all(region[key] == "" for key in ("awsRegion", "userPoolId", "clientId", "issuer"))
        assert set(region["services"]) == {"patient", "doctor", "booking", "communication", "staff", "admin"}
        assert all(value == "" for value in region["services"].values())
    content = read("mobile-content.json")
    assert all(isinstance(value, str) and value for key, value in content.items() if key not in {"residency", "roles", "theme"})
    assert set(content["residency"]) == {"US", "EU"}
    assert set(content["roles"]) == {"patient", "doctor", "staff", "admin"}
    assert all(re.fullmatch(r"#[0-9A-Fa-f]{6}", value) for value in content["theme"].values())
    contract = read("mobile-contract.json")
    web_policy = json.loads((HUB / "src/content/session-policy.json").read_text())
    consent = json.loads((HUB / "src/content/consent.json").read_text())
    legal = json.loads((HUB / "src/content/legal.json").read_text())
    assert all(isinstance(consent.get(key), str) and consent[key] for key in ("policyVersion", "signupDescription"))
    assert isinstance(legal.get("notice"), str) and legal["notice"]
    for key in ("terms", "privacy", "security"):
        page = legal["pages"][key]
        assert isinstance(page["title"], str) and page["title"]
        assert page["sections"]
        for section in page["sections"]:
            assert all(isinstance(section.get(field), str) and section[field] for field in ("title", "body"))
    assert "groups" not in contract and "defaultRole" not in contract
    assert set(web_policy["groups"].values()) == set(content["roles"])
    assert set(contract["appointments"]["query"]) == {"patient", "doctor"}
    assert re.fullmatch(r"/[A-Za-z0-9/_-]+", contract["appointments"]["path"])
    assert set(contract["profiles"]) == {"patient", "doctor"}
    for route in contract["profiles"].values():
        assert route["service"] in config["regions"]["US"]["services"]
        assert isinstance(route["appendSubject"], bool)
        assert re.fullmatch(r"[A-Za-z]+", route["subjectField"])
        for key in ("readPath", "createPath"):
            assert re.fullmatch(r"/[A-Za-z0-9/_-]+", route[key]) and "//" not in route[key]
    cancellation = contract["cancellation"]
    assert re.fullmatch(r"/[A-Za-z0-9/_-]+", cancellation["path"]) and "//" not in cancellation["path"]
    assert isinstance(cancellation["maxLookupPages"], int) and cancellation["maxLookupPages"] > 0
    assert cancellation["cancellableStatuses"] and cancellation["cancelledStatuses"]
    assert not set(cancellation["cancellableStatuses"]) & set(cancellation["cancelledStatuses"])
    count = 0
    roots = (NATIVE / "android/app/src/main/java", NATIVE / "ios/Sources")
    for root in roots:
        for path in root.rglob("*"):
            if path.suffix not in {".kt", ".swift"}:
                continue
            source = path.read_text(encoding="utf-8")
            # Fail with a file/rule, never echo a possible credential.
            for pattern in (r"https?://", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", r"AKIA[A-Z0-9]{16}", r"sk_live_[A-Za-z0-9]{16,}"):
                assert re.search(pattern, source) is None, f"Native source boundary violation: {path.name}"
            for key in re.findall(r'content\.text\("([A-Za-z]+)"\)', source):
                assert isinstance(content.get(key), str), f"Unknown content key: {key}"
            count += 1
    print(f"Native contract/configuration regression checks passed for {count} platform source files.")


if __name__ == "__main__":
    main()
