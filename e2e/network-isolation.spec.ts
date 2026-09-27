import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test, expect } from './test';

test('unmocked external HTTP and WebSocket traffic is refused', async ({ page, networkIsolation }) => {
  await page.setContent('<title>Network isolation check</title>');
  const fetched = await page.evaluate(async () => {
    try { await fetch('https://external.example.test/synthetic'); return true; }
    catch { return false; }
  });
  expect(fetched).toBe(false);
  await page.evaluate(() => {
    const socket = new WebSocket('wss://external.example.test/synthetic');
    // Observe the routing decision; browser-level socket events can race.
    Object.assign(window, { syntheticIsolationSocket: socket });
  });
  await expect.poll(() => networkIsolation).toContain('WS wss://external.example.test');
  expect(networkIsolation).toContain('HTTP https://external.example.test');
});

test('all browser specs use the automatic isolation fixture', () => {
  const folder = path.join(process.cwd(), 'e2e');
  for (const name of readdirSync(folder).filter(name => name.endsWith('.spec.ts'))) {
    const source = readFileSync(path.join(folder, name), 'utf8');
    expect(source, name).not.toMatch(/from\s+['"]@playwright\/test['"]/);
    expect(source, name).toMatch(/from\s+['"]\.\/test['"]/);
    expect(source, name).not.toMatch(/route\.continue\s*\(/);
  }
});

test('page fallbacks retain the guard and reject a different loopback port', async ({ page, baseURL, networkIsolation }) => {
  await page.route('**/*', route => route.fallback());
  await page.setContent('<title>Page fallback isolation check</title>');
  const outside = new URL(baseURL!);
  outside.port = String(Number(outside.port) + 1);
  const fetched = await page.evaluate(async url => {
    try { await fetch(url); return true; }
    catch { return false; }
  }, outside.href);
  expect(fetched).toBe(false);
  expect(networkIsolation).toContain(`HTTP ${outside.origin}`);
});

const redirectTest = test.extend<{ redirectServer: string }>({
  redirectServer: async ({ browserName: _browserName }, runTest) => {
    const server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: 'https://external.example.test/redirect-target' });
        response.end();
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<h1>Local redirect fixture</h1>');
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      await runTest(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  },
  baseURL: async ({ redirectServer }, runTest) => runTest(redirectServer),
});

redirectTest('a real local HTTP redirect cannot leave the configured origin', async ({ page, baseURL, networkIsolation }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toHaveText('Local redirect fixture');
  const fetched = await page.evaluate(async () => {
    try { await fetch('/redirect'); return true; }
    catch { return false; }
  });
  expect(fetched).toBe(false);
  expect(networkIsolation).toContain(`HTTP redirect ${new URL(baseURL!).origin}`);
});
