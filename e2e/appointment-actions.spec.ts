import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface AuthBridge { __holdAppointmentAuth: boolean; __releaseAppointmentAuth?: () => void }
async function open(page: Page, outcome: 'success' | 'failure' = 'success') {
  const writes: { method: string; path: string; body: unknown }[] = [];
  let cancelled = false;
  await page.clock.setFixedTime(new Date('2026-09-10T00:00:00Z'));
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'appointments.example.test') return route.abort();
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT',
      'access-control-allow-headers': 'authorization, content-type, x-user-region',
    } });
    if (method !== 'GET') {
      writes.push({ method, path: url.pathname, body: request.postDataJSON() });
      if (url.pathname.endsWith('/cancel') && outcome === 'success') cancelled = true;
      return route.fulfill({ status: outcome === 'success' ? 200 : 503,
        headers: { 'access-control-allow-origin': '*' }, json: { message: 'Test acknowledgement' } });
    }
    const json = url.pathname === '/doctors' ? [{ doctorId: 'test-doctor', name: 'Test Doctor', specialization: 'Test Specialty' }]
      : url.pathname === '/appointments' ? cancelled ? [] : [{ appointmentId: 'test-appointment', doctorId: 'test-doctor',
        status: 'CONFIRMED', timeSlot: '2026-09-14T09:00:00Z' }]
        : { patientId: 'test-patient', name: 'Test Patient Name' };
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json });
  });
  for (const [pattern, fixture] of [
    ['**/.vite/deps/aws-amplify_auth.js*', 'appointment-auth.mock.js'],
    ['**/src/config/env.ts*', 'appointment-config.mock.js'],
  ]) {
    await page.route(pattern, route => route.fulfill({ contentType: 'application/javascript',
      body: readFileSync(path.join(process.cwd(), 'e2e/fixtures', fixture), 'utf8') }));
  }
  await page.goto('/e2e/fixtures/appointment-actions.html');
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
  return writes;
}

test('real appointment UI checks in with patient arrival and a name-free destination', async ({ page }) => {
  const writes = await open(page);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByLabel('Test location')).toHaveText('/consultation?appointmentId=test-appointment');
  expect(writes).toEqual([{ method: 'PUT', path: '/appointments', body: { appointmentId: 'test-appointment', patientArrived: true } }]);
});

test('real appointment UI stays on the page after failed check-in', async ({ page }) => {
  const writes = await open(page, 'failure');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText('Check-in could not be completed. Please try again before entering the consultation.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Test location')).toHaveText('/appointments');
  expect(writes).toHaveLength(1);
});

test('real cancellation UI confirms cancellation without promising a refund', async ({ page }) => {
  const writes = await open(page);
  let confirmation = '';
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.accept(); });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Cancellation was confirmed. This acknowledgement does not verify that a refund has completed.', { exact: true })).toBeVisible();
  await expect(page.getByText('No upcoming appointments.')).toBeVisible();
  expect(confirmation).not.toMatch(/will refund/i);
  expect(writes).toEqual([{ method: 'POST', path: '/appointments/cancel', body: { appointmentId: 'test-appointment' } }]);
});

for (const action of ['Join', 'Cancel']) {
  test(`real ${action} action cannot dispatch after leaving during authentication`, async ({ page }) => {
    const writes = await open(page);
    await page.evaluate(() => { (window as unknown as AuthBridge).__holdAppointmentAuth = true; });
    if (action === 'Cancel') page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as AuthBridge).__releaseAppointmentAuth)).toBe('function');
    await page.getByRole('button', { name: 'Leave test appointments' }).click();
    await page.evaluate(async () => { (window as unknown as AuthBridge).__releaseAppointmentAuth!(); await Promise.resolve(); });
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Test location')).toHaveText('/appointments');
    expect(writes).toEqual([]);
  });
}
