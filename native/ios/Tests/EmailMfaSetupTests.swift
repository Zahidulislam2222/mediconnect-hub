import Amplify
import XCTest
@testable import MediConnectApp

final class EmailMfaSetupTests: XCTestCase {
    func testEmailSetupUsesDistinctInput() {
        XCTAssertEqual(SignInChallenge.input(.continueSignInWithEmailMFASetup), .email)
        XCTAssertEqual(SignInChallenge.input(.confirmSignInWithTOTPCode), .code)
        XCTAssertNil(SignInChallenge.input(.done))
    }
    func testEmailIsTrimmedAndBlankResponsesAreRejected() {
        XCTAssertEqual(SignInChallenge.response(.email, value: " test-user@example.invalid \n"), "test-user@example.invalid")
        XCTAssertNil(SignInChallenge.response(.email, value: " \n "))
        XCTAssertNil(SignInChallenge.response(.email, value: ""))
    }
    func testAddingEmailDoesNotChangeExactPasswordHandling() {
        for input: ChallengeInput in [.password, .newPassword] {
            XCTAssertTrue(SignInChallenge.response(input, value: " test-password ") == " test-password ")
        }
    }
}
