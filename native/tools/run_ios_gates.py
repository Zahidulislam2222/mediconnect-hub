"""Run on macOS/Xcode. Discover an available iPhone simulator through simctl."""
from pathlib import Path
import json
import platform
import subprocess

NATIVE = Path(__file__).resolve().parents[1]
CONFIG = json.loads((NATIVE / "shared/native-gates.json").read_text())


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
    for scheme in CONFIG["iosSchemes"]:
        command = ["xcodebuild", "-project", str(NATIVE / "ios/MediConnect.xcodeproj"), "-scheme", scheme,
                   "-destination", destination, "-derivedDataPath", str(output),
                   "CODE_SIGNING_ALLOWED=NO", "test"]
        subprocess.run(command, check=True, timeout=CONFIG["gateTimeoutSeconds"])
    print("Both iOS simulator schemes passed. Physical-device and live-provider checks remain separate.")


if __name__ == "__main__":
    main()
