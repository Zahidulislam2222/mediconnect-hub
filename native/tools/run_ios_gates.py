"""Run on macOS/Xcode. Discover an available iPhone simulator through simctl."""
from pathlib import Path
import json
import platform
import subprocess
from urllib.parse import urlsplit

NATIVE = Path(__file__).resolve().parents[1]
CONFIG = json.loads((NATIVE / "shared/native-gates.json").read_text())


def plugin_trust_entries(resolved, approved):
    pins = {pin["identity"]: pin for pin in resolved["pins"]}
    entries = []
    for plugin in approved:
        pin = pins.get(plugin["packageIdentity"])
        if not pin or pin.get("location", "").removesuffix(".git") != plugin["location"].removesuffix(".git"):
            raise ValueError("Approved plugin package origin does not match resolution")
        if pin.get("state", {}).get("revision") != plugin["fingerprint"]:
            raise ValueError("Approved plugin fingerprint does not match resolution")
        entries.append({key: plugin[key] for key in ("packageIdentity", "targetName", "fingerprint")})
    return entries


def prepare_packages(project, output):
    subprocess.run(["xcodebuild", "-resolvePackageDependencies", "-project", str(project),
                    "-scheme", CONFIG["iosSchemes"][0], "-derivedDataPath", str(output)],
                   check=True, timeout=CONFIG["gateTimeoutSeconds"])
    lock = project / "project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
    resolved = json.loads(lock.read_text())
    for pin in resolved["pins"]:
        location = urlsplit(pin["location"])
        if location.scheme != "https" or location.hostname != "github.com" or location.username or location.password:
            raise ValueError("Unexpected package source; review before building or recording resolution")
    entries = plugin_trust_entries(resolved, CONFIG["iosApprovedPlugins"])
    relative = Path(CONFIG["iosPluginTrustStore"])
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid plugin trust-store configuration")
    trust = Path.home() / relative
    existing = json.loads(trust.read_text()) if trust.exists() else []
    if not isinstance(existing, list):
        raise ValueError("Unexpected existing plugin trust format")
    for entry in entries:
        if entry not in existing:
            existing.append(entry)
    trust.parent.mkdir(parents=True, exist_ok=True)
    temporary = trust.with_suffix(".tmp")
    temporary.write_text(json.dumps(existing, indent=2) + "\n")
    temporary.replace(trust)
    # Public source coordinates only, preserved in job logs without artifact storage.
    print("NATIVE_RESOLVED_PACKAGES_JSON=" + json.dumps(resolved, separators=(",", ":")), flush=True)
    print(f"Verified {len(entries)} exact package plugin fingerprints; Xcode validation remains enabled.", flush=True)


def run_schemes(project, output, destination, settings):
    parallel = settings["iosParallelTesting"]
    if not isinstance(parallel, bool):
        raise ValueError("iOS parallel testing must be a configured boolean")
    for scheme in settings["iosSchemes"]:
        command = ["xcodebuild", "-project", str(project), "-scheme", scheme,
                   "-destination", destination, "-derivedDataPath", str(output),
                   "-parallel-testing-enabled", "YES" if parallel else "NO",
                   "CODE_SIGNING_ALLOWED=NO", "test"]
        subprocess.run(command, check=True, timeout=settings["gateTimeoutSeconds"])


def main():
    if platform.system() != "Darwin":
        raise SystemExit("iOS gate requires macOS and Xcode; source inspection is not a build.")
    subprocess.run(["xcodebuild", "-version"], check=True)
    inventory = subprocess.run(["xcrun", "simctl", "list", "devices", "available", "--json"], check=True, capture_output=True, text=True)
    devices = json.loads(inventory.stdout)["devices"]
    phones = [device for runtime in sorted(devices, reverse=True) for device in devices[runtime]
              if "iOS" in runtime and device.get("isAvailable") and device["name"].startswith("iPhone")]
    if not phones:
        raise SystemExit("No available iPhone simulator. Install an iOS simulator runtime before retrying.")
    destination = "platform=iOS Simulator,id=" + phones[0]["udid"]
    output = NATIVE / "ios/DerivedData"
    output.mkdir(exist_ok=True)
    project = NATIVE / "ios/MediConnect.xcodeproj"
    prepare_packages(project, output)
    run_schemes(project, output, destination, CONFIG)
    print("Both iOS simulator schemes passed. Physical-device and live-provider checks remain separate.")


if __name__ == "__main__":
    main()
