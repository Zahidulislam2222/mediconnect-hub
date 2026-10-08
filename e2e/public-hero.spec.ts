import { expect, test } from './test';

test('hero catches up after reverse scrolling and stops seeking offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video !== null && video.readyState >= 2;
  });
  await page.evaluate(async () => {
    const track = document.querySelector<HTMLElement>('.jy-track')!;
    const top = scrollY + track.getBoundingClientRect().top;
    const travel = track.offsetHeight - innerHeight;
    for (const fraction of [0.8, 0.2, 0.9, 0.5]) {
      scrollTo(0, top + travel * fraction);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  });
  await expect.poll(() => page.locator('video').evaluate(element => {
    const video = element as HTMLVideoElement;
    return Math.abs(video.currentTime / video.duration - 0.5);
  })).toBeLessThan(0.02);
  await expect(page.locator('.jy-film')).toHaveAttribute('data-media-failed', 'false');
  await page.locator('#explore').scrollIntoViewIfNeeded();
  const idle = await page.evaluate(async () => {
    const video = document.querySelector('video')!;
    let seeks = 0;
    const count = () => seeks++;
    video.addEventListener('seeking', count);
    for (let frame = 0; frame < 30; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    video.removeEventListener('seeking', count);
    return { seeks, paused: video.paused };
  });
  expect(idle.paused).toBe(true);
  expect(idle.seeks).toBeLessThanOrEqual(1);
});

test('failed hero media leaves a readable page and usable chapter controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/*.mp4', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-media-failed', 'true');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
  await expect(page.locator('.jy-film img')).toBeVisible();
});

test('reduced motion and short screens avoid video decoding and keep chapter access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.jy-track')).toHaveClass(/is-static/);
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});
