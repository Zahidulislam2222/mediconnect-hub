import { defineConfig } from '@playwright/test';

// Keep the E2E server isolated from shared local services. Port 8080 was
// occupied by Apache, and reuseExistingServer silently tested that process.
const e2ePort = 4173;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
  },
});
