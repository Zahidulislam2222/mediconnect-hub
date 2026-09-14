import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe } from '@stripe/stripe-js';
import { publicEnv } from '@/config/env';

let client: Promise<Stripe | null> | null = null;

// No third-party script or public-key lookup until a user opens payment UI.
export function getPaymentClient(): Promise<Stripe | null> {
  if (!client) {
    client = loadStripe(publicEnv('VITE_STRIPE_PUBLISHABLE_KEY')).then(value => {
      if (!value) client = null;
      return value;
    }).catch(() => {
      client = null;
      throw new Error('PAYMENT_SERVICE_UNAVAILABLE');
    });
  }
  return client;
}
