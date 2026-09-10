import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface BookingBridge { __bookingPosts: unknown[]; __bookingPayments: unknown[]; __completeBookingPayment: () => void }
async function open(page: Page) {
  await page.clock.setFixedTime(new Date('2026-09-10T00:00:00Z'));
  await page.addInitScript(() => {
    const bridge = window as unknown as BookingBridge;
    bridge.__bookingPosts = []; bridge.__bookingPayments = [];
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
  for (const [module, fixture] of [['lib/api.ts', 'booking-api.mock.js'], ['context/CheckoutContext.tsx', 'booking-payment.mock.js']]) {
    await page.route(`**/src/${module}*`, route => route.fulfill({ contentType: 'application/javascript',
      body: readFileSync(path.join(process.cwd(), 'e2e/fixtures', fixture), 'utf8') }));
  }
  await page.route('**/src/hooks/use-payment-lifetime.ts*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'const current = new AbortController(); export function usePaymentLifetime() { return { current }; }' }));
  await page.goto('/e2e/fixtures/booking.html');
  await page.getByLabel('1. Select Specialty').selectOption('Test Specialty');
  await page.getByLabel('2. Select Doctor').selectOption('test-doctor');
  await page.getByLabel('Date', { exact: true }).fill('2026-09-14');
  await expect(page.getByLabel(/Time Slot/)).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeDisabled();
  await page.getByLabel(/Time Slot/).selectOption({ label: '09:15' });
}

test('real booking UI preserves minute/timezone conversion, fee and one submission', async ({ page }) => {
  await open(page); await expect(page.getByText('$75.50', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to Payment' }).click();
  await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeDisabled();
  await expect(page.getByLabel('Date', { exact: true })).toBeDisabled();
  const payments = await page.evaluate(() => (window as unknown as BookingBridge).__bookingPayments);
  expect(payments).toEqual([expect.objectContaining({ amount: 75.5,
    presentation: expect.objectContaining({ confirmLabel: 'Use this payment method' }) })]);
  await page.evaluate(() => (window as unknown as BookingBridge).__completeBookingPayment());
  await expect(page.getByLabel('Test booking result')).toHaveText('confirmed');
  expect(await page.evaluate(() => (window as unknown as BookingBridge).__bookingPosts)).toEqual([
    { path: '/appointments', body: { doctorId: 'test-doctor', doctorName: 'Test Doctor',
      timeSlot: '2026-09-14T03:45:00.000Z', paymentToken: 'test-payment-method' } },
  ]);
});

test('real booking UI cannot submit a late payment selection after leaving', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Proceed to Payment' }).click();
  await page.getByRole('button', { name: 'Leave test booking' }).click();
  await page.evaluate(async () => { (window as unknown as BookingBridge).__completeBookingPayment(); await Promise.resolve(); });
  expect(await page.evaluate(() => (window as unknown as BookingBridge).__bookingPosts)).toEqual([]);
  await expect(page.getByLabel('Test booking result')).toHaveText('pending');
});
