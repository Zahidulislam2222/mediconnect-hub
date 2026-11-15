import { expect, test, type Page } from './test';
import content from '../src/content/journey.json' with { type: 'json' };

const preview = content.clinicPreview;
/** How far boxes and text reach outside the panel and outside their own tile (px), and the smallest text. */
const measure = (page: Page) => page.locator('.jy-clinic-sketch').evaluate(panel => {
  const box = panel.getBoundingClientRect();
  const art = panel.querySelector<HTMLElement>('.jy-clinic-sketch-art')!;
  const tileSelector = '.jy-hero-tile, .jy-clinic-sketch-call';
  const beyond = (edge: DOMRect, r: DOMRect) => Math.max(edge.left - r.left, r.right - edge.right, edge.top - r.top, r.bottom - edge.bottom);
  let outsidePanel = 0;
  let outsideTile = 0;
  let smallestText = Infinity;
  for (const item of art.querySelectorAll(':scope > :not(.jy-clinic-sketch-pulse), .jy-clinic-sketch-pulse > svg')) {
    outsidePanel = Math.max(outsidePanel, beyond(box, item.getBoundingClientRect()));
  }
  for (const tile of art.querySelectorAll(tileSelector)) {
    const edge = tile.getBoundingClientRect();
    for (const child of tile.querySelectorAll('*')) {
      const r = child.getBoundingClientRect();
      if (r.width > 0) outsideTile = Math.max(outsideTile, beyond(edge, r));
    }
  }
  // Text placed straight into a flex row has no element box of its own, so the words are measured directly.
  const walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT);
  let words = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    words += 1;
    const owner = node.parentElement!;
    smallestText = Math.min(smallestText, parseFloat(getComputedStyle(owner).fontSize));
    const range = document.createRange();
    range.selectNodeContents(node);
    const tile = owner.closest(tileSelector)?.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      outsidePanel = Math.max(outsidePanel, beyond(box, r));
      if (tile) outsideTile = Math.max(outsideTile, beyond(tile, r));
    }
  }
  const tiles = [...art.querySelectorAll<HTMLElement>(tileSelector)].map(tile => tile.getBoundingClientRect());
  const overlap = tiles.some((a, index) => tiles.slice(index + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
  return {
    outsidePanel, outsideTile, overlap, smallestText, words,
    panel: { width: box.width, height: box.height },
    note: parseFloat(getComputedStyle(art.querySelector('.jy-clinic-sketch-note')!).fontSize),
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

/** The first request to a cold dev server compiles the app, so the first sighting gets extra time. */
const arrived = (page: Page) => expect(page.locator('.jy-clinic-sketch')).toBeAttached({ timeout: 15000 });

for (const [width, height] of [[320, 740], [360, 780], [390, 844], [600, 900], [768, 1024], [800, 900], [801, 900], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]] as const) {
  test(`clinician illustration stays whole and readable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await arrived(page);
    const panel = page.locator('.jy-home-clinicians .jy-clinic-sketch');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();
    const layout = await measure(page);
    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
    expect(layout.outsidePanel, 'sketch outside its panel').toBeLessThanOrEqual(0.5);
    expect(layout.outsideTile, 'content outside its tile').toBeLessThanOrEqual(0.5);
    expect(layout.overlap, 'tiles overlap').toBe(false);
    expect(layout.words, 'text found in the sketch').toBeGreaterThanOrEqual(12);
    expect(layout.smallestText, 'smallest text in the sketch').toBeGreaterThanOrEqual(10);
    expect(layout.note).toBeGreaterThanOrEqual(13);
    expect(layout.panel.width).toBeLessThanOrEqual(width);
  });
}

test('clinician illustration is live code: no image, hidden from assistive technology, honest note', async ({ page }) => {
  const posters: string[] = [];
  page.on('request', request => { if (/care-thread-(clinic|home)-/.test(new URL(request.url()).pathname)) posters.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await arrived(page);
  const section = page.locator('.jy-home-clinicians');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('img, video, canvas')).toHaveCount(0);
  const panel = section.locator('.jy-clinic-sketch');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(panel.locator('.jy-clinic-sketch-row')).toHaveCount(content.sample.slots.length);
  await expect(panel.locator('.jy-clinic-sketch-row[data-now="true"] .jy-hero-time')).toHaveText(content.sample.defaultSlot);
  await expect(panel.locator('.jy-clinic-sketch-note')).toHaveText(preview.note);
  await expect(panel).not.toContainText(content.sample.patient);
  await expect(panel).not.toContainText(content.sample.doctor);
  // The section keeps its real heading and list for assistive technology.
  await expect(section.getByRole('heading', { level: 2 })).toBeVisible();
  expect(await section.getByText(preview.note).count()).toBe(1);
  expect(await page.getByRole('paragraph').filter({ hasText: preview.note }).count()).toBe(0);
  expect(posters).toEqual([]);
});

test('clinician illustration text meets 4.5:1 contrast', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await arrived(page);
  await page.locator('.jy-clinic-sketch').scrollIntoViewIfNeeded();
  const result = await page.locator('.jy-clinic-sketch').evaluate(panel => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    /** Paints the given CSS colours over each other, bottom first, and reads back the opaque result. */
    const flatten = (...colors: string[]) => {
      context.clearRect(0, 0, 1, 1);
      for (const color of colors) { context.fillStyle = color; context.fillRect(0, 0, 1, 1); }
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const color = (selector: string, property: 'color' | 'backgroundColor' = 'color') => getComputedStyle(panel.querySelector(selector)!)[property];
    const stage = getComputedStyle(panel).backgroundColor;
    // Worst case behind the note is the brightest point of the light pool; behind the call label, the
    // lightest stop of its gradient.
    const firstColor = (image: string, what: string) => {
      const found = image.match(/(?:rgba?|color)\([^)]*\)/)?.[0];
      if (!found) throw new Error(`no colour found in the ${what}: ${image}`);
      return found;
    };
    const callStart = firstColor(getComputedStyle(panel.querySelector('.jy-clinic-sketch-call')!).backgroundImage, 'call fill');
    const glow = firstColor(getComputedStyle(panel, '::after').backgroundImage, 'light pool');
    const tile = color('.jy-clinic-sketch-schedule', 'backgroundColor');
    const nowRow = color('.jy-clinic-sketch-row[data-now="true"]', 'backgroundColor');
    const on = (text: string, ...layers: string[]) => ratio(flatten(...layers, text), flatten(...layers));
    return {
      note: on(color('.jy-clinic-sketch-note'), stage, glow),
      kicker: on(color('.jy-clinic-sketch-schedule .jy-hero-kicker'), tile),
      aside: on(color('.jy-clinic-sketch-schedule .jy-hero-aside'), tile),
      label: on(color('.jy-clinic-sketch-row[data-now="false"] .jy-clinic-sketch-label'), tile),
      time: on(color('.jy-clinic-sketch-row[data-now="false"] .jy-hero-time'), tile, color('.jy-clinic-sketch-row[data-now="false"] .jy-hero-time', 'backgroundColor')),
      timeNow: on(color('.jy-clinic-sketch-row[data-now="true"] .jy-hero-time'), color('.jy-clinic-sketch-row[data-now="true"] .jy-hero-time', 'backgroundColor')),
      labelNow: on(color('.jy-clinic-sketch-row[data-now="true"] .jy-clinic-sketch-label'), tile, nowRow),
      nowBadge: on(color('.jy-clinic-sketch-label > em'), color('.jy-clinic-sketch-label > em', 'backgroundColor')),
      initials: on(color('.jy-clinic-sketch-row[data-now="false"] .jy-clinic-sketch-initials'), tile, color('.jy-clinic-sketch-row[data-now="false"] .jy-clinic-sketch-initials', 'backgroundColor')),
      initialsNow: on(color('.jy-clinic-sketch-row[data-now="true"] .jy-clinic-sketch-initials'), color('.jy-clinic-sketch-row[data-now="true"] .jy-clinic-sketch-initials', 'backgroundColor')),
      call: on(color('.jy-clinic-sketch-call'), callStart),
      callStatus: on(color('.jy-clinic-sketch-call .jy-hero-aside'), callStart),
      status: on(color('.jy-clinic-sketch-notes .jy-hero-status'), tile),
    };
  });
  for (const [name, value] of Object.entries(result)) expect(value, name).toBeGreaterThanOrEqual(4.5);
});
