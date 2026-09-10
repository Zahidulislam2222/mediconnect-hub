import Amplify
import XCTest
@testable import MediConnectApp

final class PasswordChallengeTests: XCTestCase {
    func testSupportedSDKChallengesOnly() {
        XCTAssertEqual(SignInChallenge.input(.confirmSignInWithPassword), .password)
        XCTAssertEqual(SignInChallenge.input(.confirmSignInWithNewPassword(nil)), .newPassword)
        XCTAssertEqual(SignInChallenge.input(.confirmSignInWithTOTPCode), .code)
        XCTAssertNil(SignInChallenge.input(.done))
        XCTAssertNil(SignInChallenge.input(.confirmSignInWithCustomChallenge(nil)))
    }
    func testExactPasswordsAndTrimmedCodes() {
        for input in [ChallengeInput.password, .newPassword] {
            XCTAssertTrue(SignInChallenge.response(input, value: " test-password ") == " test-password ")
        }
        XCTAssertEqual(SignInChallenge.response(.code, value: " 123456 "), "123456")
    }
    func testBlankResponsesDoNotSubmit() {
        for input in [ChallengeInput.password, .newPassword, .code] {
            XCTAssertNil(SignInChallenge.response(input, value: ""))
            XCTAssertNil(SignInChallenge.response(input, value: " \n "))
        }
    }
}
