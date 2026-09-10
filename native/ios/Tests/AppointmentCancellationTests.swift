import Combine
import XCTest
@testable import MediConnectApp

final class AppointmentCancellationTests: XCTestCase {
    private let identity = Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300))
    private let appointment = Appointment(id: "test-appointment", time: nil, person: "Test doctor", status: "CONFIRMED")
    private let policy = CancellationContract(path: "/test-cancel", cancellableStatuses: ["CONFIRMED"], cancelledStatuses: ["CANCELLED"], maxLookupPages: 3)
    @MainActor private final class Fake: CancellationService {
        var reads = 0; var posts = 0
        var appointment: Appointment
        var failure: Int?; var failRead = false; var noChange = false; var lostResponse = false
        init(_ appointment: Appointment) { self.appointment = appointment }
        func find(identity: Identity, appointmentId: String) async throws -> Appointment {
            reads += 1; if failRead { throw HTTPFailure(status: failure) }; return appointment
        }
        func cancel(identity: Identity, appointmentId: String) async throws {
            posts += 1
            if !noChange { appointment = Appointment(id: appointment.id, time: appointment.time, person: appointment.person, status: "CANCELLED") }
            if lostResponse { throw HTTPFailure(status: nil) }
        }
    }
    @MainActor private func observe(_ model: AppointmentCancellation, step: CancellationStep, action: () -> Void) async {
        let changed = expectation(description: "Cancellation reaches expected state")
        let observation = model.$state.filter { $0.step == step }.prefix(1).sink { _ in changed.fulfill() }
        action(); await fulfillment(of: [changed], timeout: 5); observation.cancel()
    }
    @MainActor func testExplicitConfirmationPatientAndConfigurationRequired() async {
        let service = Fake(appointment); let model = AppointmentCancellation(service: service, policy: policy)
        model.open(Identity(subject: identity.subject, role: .doctor, expiresAt: identity.expiresAt), appointment: appointment)
        XCTAssertEqual(model.state.step, .closed)
        model.open(identity, appointment: appointment); model.close(); model.confirm()
        XCTAssertEqual(service.posts, 0); XCTAssertEqual(service.reads, 0)
        let absent = AppointmentCancellation(service: nil, policy: policy); absent.open(identity, appointment: appointment)
        XCTAssertEqual(absent.state.step, .closed)
    }
    @MainActor func testDuplicateConfirmPostsOnceAndRequiresReadback() async {
        let service = Fake(appointment); let model = AppointmentCancellation(service: service, policy: policy)
        model.open(identity, appointment: appointment)
        await observe(model, step: .confirmed) { model.confirm(); model.confirm() }
        XCTAssertEqual(service.posts, 1); XCTAssertEqual(service.reads, 2); model.close()
    }
    @MainActor func testAlreadyCancelledDoesNotPost() async {
        let service = Fake(Appointment(id: appointment.id, time: nil, person: nil, status: "CANCELLED"))
        let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
        await observe(model, step: .confirmed) { model.confirm() }; XCTAssertEqual(service.posts, 0); model.close()
    }
    @MainActor func testMissingForbiddenAndForeignReadNeverPost() async {
        for status: Int? in [nil, 401, 403, 404, 500] {
            let service = Fake(appointment); service.failRead = true; service.failure = status
            let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
            await observe(model, step: .unconfirmed) { model.confirm() }; XCTAssertEqual(service.posts, 0); model.close()
        }
        let service = Fake(Appointment(id: "other-appointment", time: nil, person: nil, status: "CONFIRMED"))
        let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
        await observe(model, step: .unconfirmed) { model.confirm() }; XCTAssertEqual(service.posts, 0); model.close()
    }
    @MainActor func testNonCancellableAndMissingStatusNeverPost() async {
        for status: String? in [nil, "IN_PROGRESS", "COMPLETED", "UNKNOWN"] {
            let service = Fake(Appointment(id: appointment.id, time: nil, person: nil, status: status))
            let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
            await observe(model, step: .unconfirmed) { model.confirm() }; XCTAssertEqual(service.posts, 0); model.close()
        }
    }
    @MainActor func testAcknowledgementAloneNeverConfirmsOrReplays() async {
        let service = Fake(appointment); service.noChange = true
        let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
        await observe(model, step: .unconfirmed) { model.confirm() }
        model.confirm(); model.close(); model.open(identity, appointment: appointment); model.confirm()
        XCTAssertEqual(model.state.step, .unconfirmed); XCTAssertEqual(service.posts, 1); model.close()
    }
    @MainActor func testLostResponseResolvesThroughReadOnlyCheck() async {
        let service = Fake(appointment); service.lostResponse = true
        let model = AppointmentCancellation(service: service, policy: policy); model.open(identity, appointment: appointment)
        await observe(model, step: .unconfirmed) { model.confirm() }
        await observe(model, step: .confirmed) { model.check() }; XCTAssertEqual(service.posts, 1); model.close()
    }
    @MainActor func testClosingDiscardsSelectedDataAndPreventsQueuedPost() async {
        let service = Fake(appointment); let model = AppointmentCancellation(service: service, policy: policy)
        model.open(identity, appointment: appointment); model.confirm(); model.close(); await Task.yield()
        XCTAssertEqual(model.state.step, .closed); XCTAssertNil(model.state.appointment); XCTAssertEqual(service.posts, 0)
    }
}
