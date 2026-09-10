import Amplify
import XCTest
@testable import MediConnectApp

final class AuthenticatorSetupTests: XCTestCase {
    private func step(_ key: String = "test-key") -> AuthSignInStep {
        .continueSignInWithTOTPSetup(TOTPSetupDetails(sharedSecret: key, username: "test-user"))
    }
    func testMatchingSDKDetailsAreRequired() {
        XCTAssertEqual(AuthenticatorSetup.fromSDK(step())?.displayKey, "test-key")
        XCTAssertNil(AuthenticatorSetup.fromSDK(step(" \n ")))
        for other: AuthSignInStep in [.done, .confirmSignInWithTOTPCode, .continueSignInWithMFASelection([.totp]), .confirmSignInWithCustomChallenge(nil)] {
            XCTAssertNil(AuthenticatorSetup.fromSDK(other))
        }
    }
    func testDescriptionsRedactTheKey() throws {
        let setup = try XCTUnwrap(AuthenticatorSetup.fromSDK(step()))
        XCTAssertFalse(String(describing: setup).contains("test-key"))
        XCTAssertFalse(String(reflecting: setup).contains("test-key"))
    }
    func testOnlyIdleUnauthenticatedEnrollmentSurvivesAppSwitching() throws {
        let setup = try XCTUnwrap(AuthenticatorSetup.fromSDK(step()))
        XCTAssertTrue(SignInChallenge.retainForAuthenticator(challenge: true, input: .totpSetup, setup: setup, busy: false, authenticated: false))
        XCTAssertFalse(SignInChallenge.retainForAuthenticator(challenge: false, input: .totpSetup, setup: setup, busy: false, authenticated: false))
        XCTAssertFalse(SignInChallenge.retainForAuthenticator(challenge: true, input: .totpSetup, setup: nil, busy: false, authenticated: false))
        XCTAssertFalse(SignInChallenge.retainForAuthenticator(challenge: true, input: .totpSetup, setup: setup, busy: true, authenticated: false))
        XCTAssertFalse(SignInChallenge.retainForAuthenticator(challenge: true, input: .totpSetup, setup: setup, busy: false, authenticated: true))
        for input: ChallengeInput in [.code, .email, .password, .newPassword] {
            XCTAssertFalse(SignInChallenge.retainForAuthenticator(challenge: true, input: input, setup: setup, busy: false, authenticated: false))
        }
    }
    func testEnrollmentCodesAreTrimmedAndBlankValuesRejected() {
        XCTAssertEqual(SignInChallenge.response(.totpSetup, value: " 123456 \n"), "123456")
        XCTAssertNil(SignInChallenge.response(.totpSetup, value: " \n "))
    }
}
