"""Prepare only the maintained public native resources, never private recovery files."""
from pathlib import Path
import json
import shutil
import re

NATIVE = Path(__file__).resolve().parents[1]
SHARED = NATIVE / "shared"
OUTPUT = NATIVE / "ios/Resources"


def main():
    OUTPUT.mkdir(exist_ok=True)
    for name in ("mobile-content.json", "mobile-contract.json", "mobile-config.example.json"):
        json.loads((SHARED / name).read_text(encoding="utf-8"))
        shutil.copyfile(SHARED / name, OUTPUT / name)
    shutil.copyfile(NATIVE.parent / "src/content/session-policy.json", OUTPUT / "session-policy.json")
    for name in ("legal.json", "consent.json"):
        shutil.copyfile(NATIVE.parent / "src/content" / name, OUTPUT / name)
    journey_path = NATIVE.parent / "src/content/journey.json"
    journey = json.loads(journey_path.read_text(encoding="utf-8"))
    shutil.copyfile(journey_path, OUTPUT / "journey.json")
    for key in ("poster", "homePoster"):
        asset = journey["media"][key]
        if not re.fullmatch(r"/media/journey/[A-Za-z0-9_-]+\.webp", asset):
            raise ValueError("Invalid local journey asset path")
        shutil.copyfile(NATIVE.parent / "public" / asset.lstrip("/"), OUTPUT / Path(asset).name)
    local = NATIVE / "local/mobile-config.json"
    source = local if local.exists() else SHARED / "mobile-config.example.json"
    json.loads(source.read_text(encoding="utf-8"))
    shutil.copyfile(source, OUTPUT / "mobile-config.json")
    print("Prepared native resources. Configuration values were not logged.")


if __name__ == "__main__":
    main()
