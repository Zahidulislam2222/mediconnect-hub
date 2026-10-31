import { expect, test } from './test';
import content from '../src/content/journey.json' with { type: 'json' };

test('3D hero catches up after reverse scrolling and stops drawing offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-scene-state', 'ready', { timeout: 30000 });
  await expect(page.locator('.jy-scene canvas')).toHaveCount(1);
  await expect(page.locator('video')).toHaveCount(0);
  // CPU-rendered WebGL (headless Chromium without a GPU) must use the reduced-resolution profile.
  const render = await page.locator('.jy-scene canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2')!;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return { name, ratio: canvas.width / canvas.clientWidth, quality: canvas.parentElement!.dataset.renderQuality };
  });
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(render.name);
  expect(render.quality).toBe(software ? 'reduced' : 'full');
  expect(render.ratio).toBeLessThanOrEqual((software ? content.scene.softwarePixelRatio : content.scene.maxPixelRatio) + 0.01);
  await page.evaluate(async fractions => {
    const track = document.querySelector<HTMLElement>('.jy-track')!;
    const top = scrollY + track.getBoundingClientRect().top;
    const travel = track.offsetHeight - innerHeight;
    for (const fraction of fractions) {
      scrollTo(0, top + travel * fraction);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }, [0.8, 0.2, 0.9, 0.5]);
  await expect.poll(() => page.locator('.jy-scene').evaluate(element => Math.abs(Number((element as HTMLElement).dataset.progress) - 0.5)))
    .toBeLessThan(0.02);
  await expect(page.locator('.jy-film')).toHaveAttribute('data-media-failed', 'false');
  const countDraws = () => page.evaluate(async () => {
    const scene = document.querySelector('.jy-scene')!;
    let changes = 0;
    const observer = new MutationObserver(() => changes++);
    observer.observe(scene, { attributes: true, attributeFilter: ['data-progress'] });
    for (let frame = 0; frame < 30; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    observer.disconnect();
    return changes;
  });
  // Idle on screen: no scroll means no new frames.
  expect(await countDraws()).toBe(0);
  // Offscreen: a resize would normally force a redraw, but the hidden scene must not draw.
  const trackBottom = await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('.jy-track')!;
    scrollTo(0, scrollY + track.getBoundingClientRect().bottom + innerHeight);
    return track.getBoundingClientRect().bottom;
  });
  expect(trackBottom).toBeLessThan(0);
  await countDraws();
  await page.setViewportSize({ width: 1280, height: 1000 });
  expect(await page.locator('.jy-track').evaluate(track => track.getBoundingClientRect().bottom)).toBeLessThan(0);
  expect(await countDraws()).toBe(0);
});

test('3D hero skips frames in a hidden tab and recovers from a lost WebGL context', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-scene-state', 'ready', { timeout: 30000 });
  // A resize always forces a redraw, so only the hidden-tab gate can keep this at zero.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    const scene = document.querySelector('.jy-scene')!;
    const record = window as { draws?: number; drawObserver?: MutationObserver };
    record.draws = 0;
    record.drawObserver = new MutationObserver(() => record.draws!++);
    record.drawObserver.observe(scene, { attributes: true, attributeFilter: ['data-progress'] });
    scene.removeAttribute('data-progress');
  });
  await page.setViewportSize({ width: 1300, height: 1000 });
  const drawsWhileHidden = await page.evaluate(async () => {
    for (let frame = 0; frame < 20; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    const record = window as { draws?: number; drawObserver?: MutationObserver };
    record.drawObserver!.disconnect();
    delete (document as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    return record.draws! - 1; // the removeAttribute above is the one expected mutation
  });
  expect(drawsWhileHidden).toBe(0);
  await expect.poll(() => page.locator('.jy-scene').getAttribute('data-progress')).not.toBeNull();
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('.jy-scene canvas')!.getContext('webgl2')!;
    (window as { loseContext?: WEBGL_lose_context }).loseContext = gl.getExtension('WEBGL_lose_context')!;
    (window as { loseContext?: WEBGL_lose_context }).loseContext!.loseContext();
  });
  await expect(page.locator('.jy-film')).toHaveAttribute('data-scene-state', 'lost');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-media-failed', 'false');
  await expect(page.locator('.jy-scene')).not.toHaveClass(/is-ready/);
  await page.locator('.jy-scene').evaluate(scene => scene.removeAttribute('data-progress'));
  await page.evaluate(() => (window as { loseContext?: WEBGL_lose_context }).loseContext!.restoreContext());
  await expect(page.locator('.jy-film')).toHaveAttribute('data-scene-state', 'ready');
  // A fresh draw after restore rewrites the draw position the test just cleared.
  await expect(page.locator('.jy-scene')).toHaveAttribute('data-progress', /\d\.\d{3}/);
});

test('unavailable WebGL leaves a people-free poster and usable chapter controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : original.call(this, type, ...rest);
    } as typeof original;
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-media-failed', 'true');
  await expect(page.locator('.jy-scene canvas')).toHaveCount(0);
  await expect(page.locator('.jy-film img')).toHaveAttribute('src', /care-thread-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
  await expect(page.locator('.jy-film img')).toBeVisible();
});

test('reduced motion and short screens skip WebGL and keep chapter access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jy-scene')).toHaveCount(0);
  await expect(page.locator('.jy-film img')).toHaveAttribute('src', /care-thread-/);
  await page.getByRole('button', { name: /Beyond the clinic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Different places.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.locator('.jy-scene')).toHaveCount(0);
  await expect(page.locator('.jy-track')).toHaveClass(/is-static/);
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});

test('phone-width 3D hero frames the scene without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.jy-film')).toHaveAttribute('data-scene-state', 'ready', { timeout: 30000 });
  const canvas = await page.locator('.jy-scene canvas').boundingBox();
  expect(canvas?.width).toBeGreaterThan(300);
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});
