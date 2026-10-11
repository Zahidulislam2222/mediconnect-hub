import { HttpResponseError, MutationOutcomeUnknownError } from '/src/lib/api.ts?refill-fixture-original';
export { HttpResponseError, MutationOutcomeUnknownError, isRejection, rejectionReason } from '/src/lib/api.ts?refill-fixture-original';
export const api = {
  async get(path) {
    if (path.startsWith('/register-doctor')) return { name: 'Synthetic Doctor' };
    if (path.startsWith('/appointments')) return { existingBookings: [{ patientId: 'test-patient', patientName: 'Synthetic Patient' }] };
    if (path.startsWith('/prescription')) return { prescriptions: [{ prescriptionId: 'test-rx', patientId: 'test-patient', medication: 'test-med', dosage: 'Synthetic dosage', status: 'REFILL_REQUESTED', timestamp: '2026-01-01T00:00:00Z' }] };
    return {};
  },
  async put(path, body) {
    window.__refillCalls.push({ path, body });
    if (window.__refillScenario === 'refused') throw new HttpResponseError('The prescription changed. Refresh before updating it.', 409, 'The prescription changed. Refresh before updating it.');
    if (window.__refillScenario === 'uncertain') throw new MutationOutcomeUnknownError();
    if (window.__refillScenario === 'pending') return new Promise(resolve => { window.__finishCancellation = () => resolve({ prescriptionId: 'test-rx', status: 'CANCELLED' }); });
    return { prescriptionId: 'test-rx', status: 'CANCELLED' };
  },
  async post() { throw new Error('Cancellation fixture must not approve a refill'); },
};
