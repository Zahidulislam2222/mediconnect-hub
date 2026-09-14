export function useCheckout() {
  return { requestPayment: async details => { window.__pharmacyPayments.push(details); return { id: 'test-method' }; } };
}
