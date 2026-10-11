import { defineConfig } from 'vite';
import { createReleaseConfig } from '../shared-vps/vite.showcase.config';

// Preserve the public entry and critical fallback while using installed Stripe.js.
// No showcase environment overrides are applied to a connected artifact.
export default defineConfig(environment => createReleaseConfig(environment, false));
