export const PLAN_DISPLAY = [];
const initial = { planId: 'plus', status: 'active', discountPercent: 20, freeGpVisitsRemaining: 0,
  familyMembers: [], cycleStart: '', cycleEnd: '', cancelAtPeriodEnd: false };
let calls = 0;
export const subscriptionApi = {
  getStatus: async () => {
    calls++;
    if (calls === 1) return initial;
    if (window.__statusMode === 'failure') throw new Error('test-private-diagnostic');
    return new Promise(resolve => { window.__finishStatus = () => resolve({ ...initial, cancelAtPeriodEnd: true }); });
  },
  cancel: async () => ({ accessUntil: '2030-01-01T00:00:00Z' }),
  getPortalUrl: async () => new Promise(resolve => { window.__finishPortal = () => resolve({ url: 'https://billing.example.test/session' }); }),
};
