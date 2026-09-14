import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const server = base.webServer;
if (!server || Array.isArray(server) || !server.url) throw new Error('Expected one configured frontend server');
const origin = new URL(server.url);

export default defineConfig({
  ...base,
  testMatch: 'approved-journey-entry.spec.ts',
  webServer: {
    ...server,
    command: `npm run preview -- --host ${origin.hostname} --port ${origin.port} --strictPort`,
  },
});
