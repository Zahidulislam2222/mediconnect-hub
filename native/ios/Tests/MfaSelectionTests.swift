import Amplify
import AWSCognitoAuthPlugin
import XCTest
@testable import MediConnectApp

final class MfaSelectionTests: XCTestCase {
    func testSDKSelectionsUseOnlyAllowedMethodsInStableOrder() {
        for step: AuthSignInStep in [.continueSignInWithMFASelection([.email, .sms, .totp]), .continueSignInWithMFASetupSelection([.email, .sms, .totp])] {
            XCTAssertEqual(SignInChallenge.choices(step), [.totp, .sms, .email])
        }
        XCTAssertEqual(SignInChallenge.choices(.continueSignInWithMFASelection([.email])), [.email])
        XCTAssertEqual(SignInChallenge.choices(.continueSignInWithMFASetupSelection([.totp])), [.totp])
        XCTAssertTrue(SignInChallenge.choices(.continueSignInWithMFASelection([])).isEmpty)
        XCTAssertTrue(SignInChallenge.choices(.continueSignInWithMFASetupSelection([])).isEmpty)
    }
    func testUnrelatedChallengesDoNotOfferChoices() {
        for step: AuthSignInStep in [.done, .confirmSignInWithTOTPCode, .confirmSignInWithPassword, .confirmSignInWithCustomChallenge(nil), .continueSignInWithEmailMFASetup] {
            XCTAssertTrue(SignInChallenge.choices(step).isEmpty)
        }
    }
    func testSelectionRequiresExactAllowedSDKResponse() {
        let choices: [MFAType] = [.totp]
        XCTAssertEqual(SignInChallenge.selectionResponse(choices, value: MFAType.totp.challengeResponse), MFAType.totp.challengeResponse)
        for value in ["", "123456", MFAType.sms.challengeResponse, " \(MFAType.totp.challengeResponse) "] {
            XCTAssertNil(SignInChallenge.selectionResponse(choices, value: value))
        }
        XCTAssertNil(SignInChallenge.selectionResponse([], value: MFAType.totp.challengeResponse))
    }
}
