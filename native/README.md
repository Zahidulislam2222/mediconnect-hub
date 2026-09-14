# Native mobile clients

Android uses Kotlin and Jetpack Compose. iOS uses Swift and SwiftUI. The React website and
existing Capacitor project remain separate and are preserved during migration.

The native implementation is **incomplete**. It includes sign-in, registration, recovery,
SDK-authorized MFA selection, email and authenticator setup, session handling, own-profile
setup, patient/doctor appointment lists, and patient cancellation with confirmation and status
readback. Patients can edit their profile and notification preferences; a save is confirmed
only after matching server readback. Known privacy failures use strict, bounded response parsing.
Avatar changes, complete export and erasure flows, booking/rescheduling, billing, messaging,
consultations, records and staff/admin workspaces remain unfinished.

The public welcome preserves the approved clinic-to-home story and shared poster assets.
Knowledge and journal lists, search/category filters, article readers and policy viewers use
canonical local content. Fictional patient, clinician and clinic-team demos share a sample
schedule and an in-memory note. Only the patient edits that note; the clinician reads it and
clinic-team screens omit it. Demo state is not a patient record and grants no authenticated role.
The consultation preview uses illustrative controls without microphone, camera or calling APIs.

Policy citations open only after a tap. Viewing a policy does not accept registration consent.
Authenticator enrollment requires an explicit key-reveal action. Switching apps clears the
visible key and typed code; only an idle pending enrollment survives that transition.

## Verified scope

The current local Android integration passed 256 unit/transport tests and 134 emulator UI tests
across US and EU, all four debug/unsigned release builds, and lint with zero errors and 11
warnings per region. The warnings comprise version advisories, a backup-policy advisory and
code-style suggestions. Host configuration/resource checks, current-source security scans and
independent source review passed. The authenticator flow is exercised with a real software
keyboard, a visible control within the scroll viewport and one physical tap.

The separate exact-commit iOS verification for `cd6c95147ae249d7f084b804cf1880d49d2cc1db`
passed 222 unit tests and 72 UI tests across both regional simulator schemes, including the
largest-text settings save flow. See [run 34717729755](https://github.com/Zahidulislam2222/mediconnect-hub/actions/runs/34717729755).
The subsequent keyboard-resize correction changes Android files only.

These results use synthetic data and blank provider configuration. They do not establish
physical-device behavior, signing, actual regional providers, complete feature parity or
permanent elimination of intermittent test failures. The export checksum foundation is a
separate candidate and is not a complete export feature in this checkout.

## Configuration

`shared/mobile-config.example.json` describes public settings. Copy it to the ignored
`local/mobile-config.json` and populate both regional entries from the approved deployment.
The untouched example intentionally blocks connections. Do not insert client secrets, passwords,
signing keys or API keys. Cognito must use a public app client; the SDK manages session tokens.

Configuration owns request deadlines, response limits, regional Cognito pool/client/issuer and
service base URLs. `src/content/session-policy.json` owns role aliases and is packaged alongside
canonical consent/legal JSON. `shared/mobile-contract.json` owns appointment, own-profile and
patient-settings contracts; `shared/mobile-content.json` owns copy and theme colors. HTTP/JWT
field names and Android resize flags are protocol syntax. Each region has its own build variant;
runtime region switching and cross-region failover are not implemented.

## Android

Use Java 17 and Android SDK 36. The checked-in Gradle wrapper verifies its distribution checksum;
dependencies and plugins are pinned in the version catalogue.

```sh
cd native/android
./gradlew :app:testUsDebugUnitTest :app:testEuDebugUnitTest
./gradlew :app:lintUsDebug :app:lintEuDebug
./gradlew :app:assembleUsDebug :app:assembleEuDebug :app:assembleUsRelease :app:assembleEuRelease
./gradlew :app:connectedUsDebugAndroidTest :app:connectedEuDebugAndroidTest
```

On Windows, use `gradlew.bat`. Instrumented tests require a connected emulator or Android device.
Real-keyboard tests require the software keyboard to remain available even with a hardware
keyboard connected. Record test-device settings before changing them and restore them afterward.
The production activity uses explicit keyboard resize handling. The instrumentation host uses
the same resize policy in debug builds and is absent from release builds.

## iOS

Compile and run simulator tests on macOS with Xcode. The XcodeGen specification pins Amplify and
defines both regional schemes. Run these commands from the repository root:

```sh
python3 native/tools/check_native_contract.py
python3 native/tools/prepare_ios_resources.py
xcodegen generate --spec native/ios/project.yml
python3 native/tools/run_ios_gates.py
```

The `native-ios.yml` workflow runs on verification-branch pushes (`verify/native-ios/**`) or
manual dispatch once registered on the default branch. It builds pinned XcodeGen source and
runs both regional gates on a standard macOS runner only for public repositories. It does not
upload artifacts, sign, publish an app or deploy. Verify runner eligibility and billing before
starting a run. Windows Swift checks do not replace macOS or device verification.

Use synthetic accounts and data for tests. Never put patient data or authentication material in
fixtures, screenshots or logs. Live-provider verification and full feature parity remain separate
gates; store publication is not part of this verification workflow.
