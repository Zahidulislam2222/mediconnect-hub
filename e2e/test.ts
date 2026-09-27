import { test as base, expect } from '@playwright/test';
import { networkPolicy } from './network-policy';

type NetworkGuard = { blocked: string[]; drain: () => Promise<void> };

export const test = base.extend<{ networkGuard: NetworkGuard; networkIsolation: string[] }>({
  networkGuard: [async ({ context, baseURL }, runTest, testInfo) => {
    if (!baseURL) throw new Error('Browser tests require the configured local origin');
    const origin = new URL(baseURL);
    const blocked: string[] = [];
    const pending = new Set<Promise<void>>();
    let closing = false;
    await context.route('**/*', async route => {
      if (closing) return route.abort('blockedbyclient');
      const operation = (async () => {
        const url = new URL(route.request().url());
        if (url.origin !== origin.origin) {
          blocked.push(`HTTP ${url.origin}`);
          return route.abort('blockedbyclient');
        }
        // Browser redirects bypass routing. Inspect the local response without
        // following redirects, and never pass a redirect response to the browser.
        const readOnlyRequest = ['GET', 'HEAD'].includes(route.request().method());
        const response = await route.fetch({
          maxRedirects: 0,
          maxRetries: readOnlyRequest ? networkPolicy.localConnectionResetRetries : 0,
        });
        try {
          if (response.status() >= 300 && response.status() < 400) {
            blocked.push(`HTTP redirect ${url.origin}`);
            return await route.abort('blockedbyclient');
          }
          await route.fulfill({ response });
        } finally {
          await response.dispose();
        }
      })();
      pending.add(operation);
      try { await operation; } finally { pending.delete(operation); }
    });
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      const expectedProtocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
      if (url.protocol === expectedProtocol && url.host === origin.host) {
        socket.connectToServer();
        return;
      }
      blocked.push(`WS ${url.origin}`);
      socket.close();
    });
    await runTest({ blocked, drain: async () => {
      // Abort new requests while the guard remains installed and local reads finish.
      closing = true;
      await Promise.all(pending);
    } });
    // Origins only: never retain request bodies, query strings or auth material.
    await testInfo.attach('blocked-network-origins', {
      body: Buffer.from(JSON.stringify([...new Set(blocked)], null, 2)),
      contentType: 'application/json',
    });
  }, { auto: true }],
  networkIsolation: async ({ networkGuard }, runTest) => runTest(networkGuard.blocked),
  page: async ({ networkGuard, page }, runTest) => {
    // Install the automatic guard before page construction, but drain it before
    // the built-in page fixture closes the page at teardown.
    await runTest(page);
    await networkGuard.drain();
  },
});

export { expect };
export type { Page } from '@playwright/test';
