# Native mobile clients

Android uses Kotlin and Jetpack Compose. iOS uses Swift and SwiftUI. The React website and the
existing Capacitor project remain separate and are preserved during migration.

This is an **incomplete native implementation**. The first slice covers sign-in, code confirmation,
password recovery, registration, canonical policy viewers, own-profile setup, secure password/new-password
challenges, SDK-authorized MFA method selection and email setup, session handling, patient/doctor appointment lists and
patient cancellation with confirmation and status readback. Staff/admin workspaces,
booking/rescheduling, billing, messaging, consultations, records and other web
features still need native implementation. A successful build does not establish feature parity,
live-provider behavior, clinical readiness or physical-device behavior.

## Configuration

`shared/mobile-config.example.json` describes public settings. Copy it to the ignored
`local/mobile-config.json` and populate both regional entries from the approved deployment.
The untouched example intentionally blocks connections. Do not insert client secrets, passwords,
signing keys or API keys. Cognito must use a public app client; session tokens are managed by the SDK.

The configuration owns request deadlines, response limits, regional Cognito pool/client/issuer
and service base URLs. The existing `src/content/session-policy.json` owns role aliases and is
packaged into both native apps alongside the canonical consent/legal JSON; `shared/mobile-contract.json` owns appointment and own-profile routing;
`shared/mobile-content.json` owns copy and theme colors. JWT/HTTP field names are protocol syntax.
US and EU initially have separate build variants. Regional switching inside one running app is
not implemented. There is no cross-region failover.

## Android

Open `android/` in Android Studio. Use Java 17 and Android SDK 36. The checked-in Gradle wrapper
verifies the distribution checksum. Dependencies and plugins are pinned in the version catalogue.

```sh
cd native/android
./gradlew :app:testUsDebugUnitTest :app:testEuDebugUnitTest
./gradlew :app:lintUsDebug :app:lintEuDebug :app:assembleUsDebug :app:assembleEuDebug
./gradlew :app:connectedUsDebugAndroidTest :app:connectedEuDebugAndroidTest
```

On Windows, use `gradlew.bat`. Instrumented tests require a connected emulator or Android device.
Default blank configuration never contacts a real provider. Authentication and data-flow tests
against a real approved test environment remain a separate gate.

## iOS

Author Swift files on Windows; compile the app and run simulator tests on macOS with Xcode.
The XcodeGen specification pins the Amplify package and defines both regional schemes.

```sh
python3 native/tools/check_native_contract.py
python3 native/tools/prepare_ios_resources.py
xcodegen generate --spec native/ios/project.yml
python3 native/tools/run_ios_gates.py
```

The `native-ios.yml` workflow runs on explicit verification-branch pushes (`verify/native-ios/**`)
or manual dispatch once registered on the default branch. It builds the pinned XcodeGen source and runs these
gates on a standard macOS runner only for public repositories. It does not upload artifacts, sign,
publish or deploy. Check runner eligibility and billing before enabling/dispatching it. The local
presence of this workflow is not evidence that it has run.

Verification run [34459508699](https://github.com/Zahidulislam2222/mediconnect-hub/actions/runs/34459508699)
passed for commit `6255d9c56092aa099911cc984177e81ea1a6db0b`: both regional simulator schemes built
and passed their unit and UI tests. Signed distribution builds, physical devices, live providers and
independent review remain separate, incomplete gates.

UI tests expect the safe default blank configuration; use synthetic accounts/data for any added
connected tests. Do not put patient data or authentication material in fixtures, screenshots or logs.

That passing baseline covers registration, profiles, password challenges and cancellation. It fixes
the preceding run's two Swift test enum-constructor errors. Newer MFA-selection/email-setup changes
need their own matching successful Mac run. MFA selection offers only the methods supplied
by the SDK. Authenticator enrollment keeps the SDK setup key in memory with redacted diagnostics,
requires an explicit reveal action, and clears the visible key and typed code when switching apps.
Only an idle pending enrollment survives the app switch; cancellation discards it.
Other unsupported challenges still need implementation.
Provider account, profile and cancellation tests use synthetic boundaries only.

The authenticator-enrollment Android snapshot passes 152 unit/transport tests and 54 emulator UI tests across
US/EU, both debug and optimized unsigned release builds, lint (zero errors; 18 warnings per region),
and both actual launcher checks. All four APKs were checked for blank provider configuration.
