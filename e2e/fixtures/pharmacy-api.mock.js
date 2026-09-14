const prescription = id => ({ prescriptionId: id, medication: id, dosage: 'Synthetic dosage', timestamp: '2026-01-01T00:00:00Z', status: window.__pharmacyScenario === 'refill' ? 'PICKED_UP' : 'ISSUED', paymentStatus: window.__pharmacyScenario === 'payment' ? 'UNPAID' : 'PAID', price: 99, livePrice: 12, liveStock: 5, refillsRemaining: 2 });
export const api = {
  async get(path) {
    if (path.startsWith('/register-patient')) return { name: 'Synthetic Patient' };
    if (path.startsWith('/prescription')) return { prescriptions: [prescription('test-alpha'), prescription('test-beta')] };
    if (path.startsWith('/billing')) return { currency: 'USD', transactions: [{ billId: 'test-bill', referenceId: 'test-alpha', patientId: 'test-patient', amount: 12, status: 'PENDING' }] };
    return {};
  },
  async post(path, body) {
    window.__pharmacyCalls.push({ path, body });
    if (path === '/pharmacy/request-refill') return { message: 'Refill authorized' };
    if (path === '/billing/pay') return { status: 'processing' };
    if (window.__pharmacyScenario === 'hold') return new Promise(resolve => { window.__finishPharmacy = () => resolve({ qrPayload: 'PICKUP-' + body.prescriptionId }); });
    return window.__pharmacyScenario === 'valid' ? { qrPayload: 'PICKUP-' + body.prescriptionId } : {};
  },
};
