// React Stripe Elements accepts null while payments are unavailable.
// Used only by the static showcase build; the real integration remains in source.
export function loadStripe() {
  return Promise.resolve(null);
}
