export function useCheckout() {
  return { requestPayment: details => {
    window.__bookingPayments.push(details);
    return new Promise(resolve => { window.__completeBookingPayment = () => resolve({ id: 'test-payment-method' }); });
  } };
}
