import { expect, test } from './test';
import site from '../src/content/public-site.json' with { type: 'json' };
import routes from '../src/config/public-site-routing.json' with { type: 'json' };
import journey from '../src/content/journey.json' with { type: 'json' };
import journeyRoutes from '../src/config/journey-routing.json' with { type: 'json' };

for (const [id, destination] of Object.entries(routes)) {
  test(`public ${id} page supports a direct visit and shared navigation`, async ({ page }) => {
    await page.goto(destination);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.pages[id as keyof typeof site.pages].title);
    await expect(page.getByRole('navigation', { name: site.navigationLabel })).toBeVisible();
    await expect(page.locator('.jy-public-section')).toHaveCount(site.pages[id as keyof typeof site.pages].sections.length);
    await page.locator('.jy-header .jy-brand').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.jy-track')).toBeVisible();
  });
}

test('homepage exposes substantive pages without unverified booking or contact claims', async ({ page }) => {
  await page.goto('/');
  for (const item of site.navigation) {
    await expect(page.locator('.jy-header').getByRole('link', { name: item.label, exact: true })).toHaveAttribute('href', routes[item.id as keyof typeof routes]);
  }
  await expect(page.locator('.jy-footer')).toContainText(site.status);
  await expect(page.locator('.jy-app')).not.toContainText(/\b(?:demo(?:nstrat\w*)?|preview|sample|fictional|portfolio|mockup|simulation|concept)\b/i);
  await expect(page.locator('.jy-actions .jy-button')).toHaveAttribute('href', '/auth');
});

test('mobile public navigation fits, closes on navigation and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.jy-menu');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: site.navigationLabel }).getByRole('link', { name: site.navigation[0].label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.about}$`));
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});

test('public-page browser history and related-page actions work', async ({ page }) => {
  await page.goto(routes.about);
  await page.getByRole('link', { name: site.pages.about.actionLabel }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.services}$`));
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.pages.about.title);
});

test('public entry defers account dependencies and reaches guarded authentication', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', request => loaded.push(new URL(request.url()).pathname));
  await page.goto(routes.about);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.pages.about.title);
  expect(loaded.some(path => /authenticated-main|src\/App\.tsx|aws-amplify/.test(path))).toBe(false);
  await page.locator('.jy-header').getByRole('link', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/jy-document/);
  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('public actions fit a narrow screen while local fonts are still loading', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let releaseFonts!: () => void;
  const fontGate = new Promise<void>(resolve => { releaseFonts = resolve; });
  await page.route('**/*.woff2', async route => { await fontGate; await route.fallback(); });
  try {
    for (const destination of Object.values(routes)) {
      await page.goto(destination, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.width);
    }
  } finally { releaseFonts(); }
});

test('public pages, articles and notices obey the visible-content constraint', async ({ page }) => {
  const destinations = new Set([
    ...Object.values(routes), ...Object.values(journey.publicLinks),
    journeyRoutes.application.knowledge, journeyRoutes.application.blog,
    ...journey.articles.map(article => `${journeyRoutes.application[article.kind as 'knowledge' | 'blog']}/${article.slug}`),
  ]);
  for (const destination of destinations) {
    await page.goto(destination);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/\b(?:demo(?:nstrat\w*)?|preview|sample|fictional|portfolio|mockup|simulation|concept|illustrative|synthetic)\b/i);
  }
});
