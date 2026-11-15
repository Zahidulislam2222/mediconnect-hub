import { expect, test, type Page } from './test';
import content from '../src/content/journey.json' with { type: 'json' };
import site from '../src/content/public-site.json' with { type: 'json' };

const moments = content.moments;
const last = moments[moments.length - 1];
const momentButton = (page: Page, label: string) => page.locator('.jy-hero').getByRole('button', { name: new RegExp(`\\d ${label}$`) });
const states = (page: Page) => page.locator('.jy-hero-moment').evaluateAll(items => items.map(item => (item as HTMLElement).dataset.state));
const settled = (page: Page) => expect(page.locator(`.jy-hero-moment.is-${last.id}`)).toHaveAttribute('data-state', 'current', { timeout: 15000 });
const runningAnimations = (page: Page) => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
/** The hero clips its own overflow, so page width alone cannot see a sketch spilling out of its tile. */
const spill = (page: Page) => page.locator('.jy-hero .jy-hero-tile').evaluateAll(tiles => tiles.flatMap(tile => {
  const edge = tile.getBoundingClientRect();
  return [...tile.querySelectorAll('*')].filter(child => {
    const box = child.getBoundingClientRect();
    return box.width > 0 && (box.right > edge.right + 0.5 || box.left < edge.left - 0.5);
  }).map(child => `${tile.parentElement!.textContent!.slice(0, 12)}: ${child.className || child.tagName}`);
}));
const insidePage = async (page: Page, width: number) => {
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await spill(page)).toEqual([]);
  for (const selector of ['.jy-hero .jy-hero-tile', '.jy-hero-caption', '.jy-hero-note', '.jy-hero-copy h1', '.jy-hero .jy-actions']) {
    for (const box of await page.locator(selector).evaluateAll(items => items
      .filter(item => getComputedStyle(item).visibility === 'visible')
      .map(item => { const r = item.getBoundingClientRect(); return { left: r.left, right: r.right }; }))) {
      expect(box.left, selector).toBeGreaterThanOrEqual(0);
      expect(box.right, selector).toBeLessThanOrEqual(width + 0.5);
    }
  }
};

for (const [width, height] of [[1440, 900], [1600, 900], [1920, 1080], [1280, 720]] as const) {
  test(`hero fits one ${width}x${height} screen and loads no 3D scene or video`, async ({ page }) => {
    const heavy: string[] = [];
    page.on('request', request => { if (/three|\.mp4|\.glb/i.test(new URL(request.url()).pathname)) heavy.push(request.url()); });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await settled(page);
    const layout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('.jy-hero')!.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('.jy-header')!.getBoundingClientRect();
      const explore = document.getElementById('explore')!.getBoundingClientRect();
      const note = document.querySelector<HTMLElement>('.jy-hero-note')!.getBoundingClientRect();
      return { hero: hero.height, room: innerHeight - header.height, gap: explore.top - hero.bottom, note: note.bottom, fold: innerHeight };
    });
    expect(layout.hero).toBeLessThanOrEqual(layout.room + 1);
    expect(layout.note).toBeLessThanOrEqual(layout.fold);
    expect(Math.abs(layout.gap)).toBeLessThanOrEqual(1);
    await insidePage(page, width);
    await expect(page.locator('canvas, video')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.jy-hero-moment')).toHaveCount(moments.length);
    await expect(page.locator('.jy-hero-note')).toContainText(content.hero.illustrationNote);
    await expect(page.locator('.jy-hero-note')).toContainText(site.status);
    expect(heavy).toEqual([]);
  });
}

test('thread reaches every moment within five seconds and then rests', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(momentButton(page, moments[0].label)).toBeVisible();
  const started = Date.now();
  await settled(page);
  await expect.poll(() => runningAnimations(page), { timeout: 5000 }).toBe(0);
  expect(Date.now() - started).toBeLessThan(5000);
  expect(await states(page)).toEqual(['reached', 'reached', 'reached', 'current']);
  const drawn = await page.locator('.jy-hero-wire').evaluateAll(wires => wires.map(wire => getComputedStyle(wire).strokeDashoffset));
  expect(drawn).toEqual(['0px', '0px', '0px', '0px']);
  const lit = await page.locator('.jy-hero .jy-hero-tile').evaluateAll(tiles => tiles.map(tile => getComputedStyle(tile).opacity));
  expect(lit).toEqual(['1', '1', '1', '1']);
  // Still idle a moment later: nothing loops.
  await page.waitForTimeout(700);
  expect(await runningAnimations(page)).toBe(0);
});

test('choosing a moment moves the thread by mouse and by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await settled(page);
  await momentButton(page, moments[1].label).click();
  expect(await states(page)).toEqual(['reached', 'current', 'ahead', 'ahead']);
  await expect(momentButton(page, moments[1].label)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`.jy-hero-moment.is-${moments[1].id} .jy-hero-caption`)).toBeVisible();
  await expect(page.locator(`.jy-hero-moment.is-${moments[1].id} .jy-hero-caption`)).toContainText(moments[1].body);
  await expect(page.locator(`.jy-hero-moment.is-${last.id} .jy-hero-caption`)).toBeHidden();
  await expect.poll(() => page.locator('.jy-hero-wire').evaluateAll(wires => wires.map(wire => getComputedStyle(wire).strokeDashoffset)))
    .toEqual(['0px', '0px', '1px', '1px']);
  await momentButton(page, moments[2].label).focus();
  await page.keyboard.press('Tab');
  await expect(momentButton(page, last.label)).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await states(page)).toEqual(['reached', 'reached', 'reached', 'current']);
  await expect(page.locator(`.jy-hero-moment.is-${last.id} .jy-hero-caption`)).toBeVisible();
  const targets = await page.locator('.jy-hero-moment > button').evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    return Math.min(box.width, box.height);
  }));
  for (const size of targets) expect(size).toBeGreaterThanOrEqual(24);
});

test('a choice made during the load sequence is kept', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await momentButton(page, moments[0].label).click();
  await page.waitForTimeout(content.heroMotion.startDelayMs + moments.length * content.heroMotion.stepMs + 300);
  expect(await states(page)).toEqual(['current', 'ahead', 'ahead', 'ahead']);
});

test('every moment keeps its name and description while its caption is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await settled(page);
  for (const [index, moment] of moments.entries()) {
    const button = momentButton(page, moment.label);
    await expect(button).toHaveAccessibleName(`${index + 1} ${moment.label}`);
    await expect(button).toHaveAccessibleDescription(`${moment.title} ${moment.body}`);
  }
  // Only the current caption is shown; the other three are the hidden ones described above.
  await expect(page.locator('.jy-hero-caption:visible')).toHaveCount(1);
  await expect(page.getByRole('list', { name: content.hero.momentsLabel })).toBeVisible();
  await expect(page.locator('.jy-hero-tile[aria-hidden="true"]')).toHaveCount(moments.length);
});

test('hero text meets 4.5:1 contrast and keyboard focus is clearly visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await settled(page);
  await momentButton(page, moments[1].label).click();
  await expect.poll(() => runningAnimations(page), { timeout: 5000 }).toBe(0);
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    // Paints each colour over the previous ones, so translucent CSS colours resolve to what is seen.
    const flatten = (...layers: string[]) => {
      context.clearRect(0, 0, 1, 1);
      for (const layer of layers) { context.fillStyle = layer; context.fillRect(0, 0, 1, 1); }
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = (rgb: number[]) => rgb
      .map(value => value / 255)
      .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (front: number[], back: number[]) => {
      const [light, dark] = [luminance(front), luminance(back)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const hero = document.querySelector<HTMLElement>('.jy-hero')!;
    const stage = getComputedStyle(hero).backgroundColor;
    const glow = getComputedStyle(hero, '::after').backgroundImage.match(/(?:rgba?|color)\([^)]*\)/)?.[0] ?? 'transparent';
    // Worst case behind the text: the stage with the brightest point of the light pool over it.
    const backdrop = flatten(stage, glow);
    const contrast: Record<string, number> = {};
    for (const [name, selector] of Object.entries({
      headline: '.jy-hero-copy h1',
      body: '.jy-hero-body',
      link: '.jy-hero .jy-text-link',
      tag: '.jy-hero-moment[data-state="ahead"] .jy-hero-tag',
      captionTitle: '.jy-hero-moment[data-state="current"] .jy-hero-caption strong',
      caption: '.jy-hero-moment[data-state="current"] .jy-hero-caption',
      note: '.jy-hero-note',
    })) {
      const color = getComputedStyle(document.querySelector(selector)!).color;
      contrast[name] = ratio(flatten(...[stage, glow], color), backdrop);
    }
    const numbered = document.querySelector('.jy-hero-moment[data-state="current"] .jy-hero-tag > span')!;
    contrast.tagNumber = ratio(flatten(getComputedStyle(numbered).color), flatten(stage, glow, getComputedStyle(numbered).backgroundColor));
    const button = document.querySelector('.jy-hero .jy-button')!;
    contrast.button = ratio(flatten(getComputedStyle(button).color), flatten(getComputedStyle(button).backgroundColor));
    return { contrast, backdrop, stage: flatten(stage) };
  });
  for (const [name, value] of Object.entries(result.contrast)) expect(value, name).toBeGreaterThanOrEqual(4.5);
  // Keyboard focus: a solid outline in the thread tint, at least 3:1 against the stage.
  await momentButton(page, moments[0].label).focus();
  await page.keyboard.press('Tab');
  const ring = await momentButton(page, moments[1].label).evaluate(button => {
    const style = getComputedStyle(button);
    const tint = getComputedStyle(document.querySelector('.jy-hero-wires')!).color;
    return { focused: button.matches(':focus-visible'), style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor, tint };
  });
  expect(ring.focused).toBe(true);
  expect(ring.style).toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(2);
  expect(ring.color).toBe(ring.tint);
  const link = page.locator('.jy-hero .jy-button');
  await link.focus();
  expect(await link.evaluate(element => getComputedStyle(element).outlineColor)).toBe(ring.tint);
});

test('reduced motion shows the finished hero at once with no transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(momentButton(page, moments[0].label)).toBeVisible();
  expect(await states(page)).toEqual(['reached', 'reached', 'reached', 'current']);
  const motion = await page.evaluate(() => [...document.querySelectorAll('.jy-hero-tile, .jy-hero-wire, .jy-hero-caption, .jy-hero-moment > button, .jy-hero-wave > i')].map(element => {
    const style = getComputedStyle(element);
    return `${style.transitionProperty}|${style.animationName}`;
  }));
  for (const value of motion) expect(value).toBe('none|none');
  await momentButton(page, moments[1].label).click();
  expect(await states(page)).toEqual(['reached', 'current', 'ahead', 'ahead']);
  expect(await runningAnimations(page)).toBe(0);
});

for (const [width, height] of [[320, 740], [360, 780], [390, 844]] as const) {
  test(`phone width ${width} shows a captioned timeline without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await settled(page);
    await insidePage(page, width);
    await expect(page.locator('.jy-hero-wires')).toBeHidden();
    for (const moment of moments) await expect(page.locator(`.jy-hero-moment.is-${moment.id} .jy-hero-caption`)).toBeVisible();
    const primary = await page.locator('.jy-hero').getByRole('link', { name: content.hero.primary }).boundingBox();
    if (height >= 844) expect(primary!.y + primary!.height).toBeLessThanOrEqual(height);
  });
}

for (const [width, height] of [[700, 900], [768, 1024], [1024, 768], [1100, 800]] as const) {
  test(`hero at ${width}x${height} keeps every moment inside the page`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await settled(page);
    await insidePage(page, width);
  });
}

test('hero actions lead to account access and to the next section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const hero = page.locator('.jy-hero');
  await expect(hero.getByRole('link', { name: content.hero.primary })).toHaveAttribute('href', '/auth');
  await expect(hero.getByRole('link', { name: content.hero.primary })).toHaveClass(/jy-button/);
  await hero.getByRole('link', { name: content.hero.secondary }).click();
  await expect(page).toHaveURL(/#explore$/);
  await expect(page.locator('#explore')).toBeInViewport();
});
