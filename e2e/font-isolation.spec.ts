import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const manifest: { assets: { file: string; kind: string }[] } = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public/fonts/manifest.json'), 'utf8'),
);

test('authentication typography loads locally when the external font provider is unreachable', async ({ page }) => {
  const externalFonts: string[] = [];
  const fontResponses = new Map<string, number>();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/fonts/')) fontResponses.set(url.pathname, response.status());
  });
  await page.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => {
    externalFonts.push(new URL(route.request().url()).hostname);
    return route.abort();
  });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: /welcome|sign in/i }).first()).toBeVisible();
  const typography = await page.evaluate(async () => {
    await document.fonts.ready;
    const [inter, sora] = await Promise.all([document.fonts.load('400 16px Inter'), document.fonts.load('600 16px Sora')]);
    return { inter: inter.length > 0 && inter.every(face => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'Inter'),
      sora: sora.length > 0 && sora.every(face => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'Sora') };
  });
  expect(externalFonts).toEqual([]);
  expect(typography).toEqual({ inter: true, sora: true });
  for (const asset of manifest.assets.filter(asset => asset.kind === 'font')) {
    expect(fontResponses.get(`/fonts/${asset.file}`)).toBe(200);
  }
});
