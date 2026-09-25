// S4 (memory/safe-followups-acceptance-20260925.md): a /billing/pay refusal the booking service returns before it calls
// the payment provider reaches the page with its code, so the page can say the patient was not charged.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
vi.mock('../secure-storage', () => ({ getUser: vi.fn().mockReturnValue({ role: 'patient' }) }));
vi.stubEnv('VITE_API_PRIMARY_TIMEOUT_MS', '25');
vi.stubEnv('VITE_BOOKING_SERVICE_URL_US', 'https://booking.us.example.test');
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { api, HttpResponseError, MutationOutcomeUnknownError } = await import('../api');
const { refusedBeforeCharge } = await import('../payment-refusal');

const reply = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });
const pay = () => api.post('/billing/pay', { billId: 'test-bill' }).then(() => { throw new Error('expected a refusal'); }, (e: unknown) => e);

describe('pay refusals made before any charge', () => {
  beforeEach(() => { mockFetch.mockReset(); localStorage.setItem('userRegion', 'US'); });

  it.each(['BILL_ALREADY_PAID', 'BILL_NOT_PAYABLE', 'BILL_AMOUNT_REQUIRES_REVIEW'])('a 409 %s keeps its code and is not-charged', async code => {
    mockFetch.mockResolvedValueOnce(reply(409, { code }));
    const error = await pay();
    expect(error).toBeInstanceOf(HttpResponseError);
    expect((error as InstanceType<typeof HttpResponseError>).code).toBe(code);
    expect(refusedBeforeCharge(error)).toBe(true);
  });

  it.each([
    ['a reconciliation 409 that can follow a provider call', 409, { code: 'PAYMENT_RECONCILIATION_REQUIRED' }],
    ['a 409 without a code', 409, {}],
    ['a 409 whose code is not text', 409, { code: 42 }],
    ['a pre-charge code on another status', 400, { code: 'BILL_NOT_PAYABLE' }],
  ])('%s is not reported as not-charged', async (_label, status, body) => {
    mockFetch.mockResolvedValueOnce(reply(status, body));
    expect(refusedBeforeCharge(await pay())).toBe(false);
  });

  it('a reply code that is not text is dropped', async () => {
    mockFetch.mockResolvedValueOnce(reply(409, { code: 42 }));
    const error = await pay();
    expect(error).toBeInstanceOf(HttpResponseError);
    expect((error as InstanceType<typeof HttpResponseError>).code).toBeUndefined();
  });

  it('an unconfirmed outcome is not reported as not-charged', async () => {
    mockFetch.mockResolvedValueOnce(reply(503, { code: 'OUTCOME_UNKNOWN' }));
    const error = await pay();
    expect(error).toBeInstanceOf(MutationOutcomeUnknownError);
    expect(refusedBeforeCharge(error)).toBe(false);
  });
});
