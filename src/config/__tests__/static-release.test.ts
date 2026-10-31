// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createServer, loadConfigFromFile, type IndexHtmlTransformContext } from 'vite';
type JourneyModule = typeof import('../../content/journey');
import { journey as served } from '../../content/journey';

vi.mock('../../content/journey', async importOriginal => {
  const original = await importOriginal<JourneyModule>();
  const copy = '<tag> & "quoted" $& $$ $1';
  return { ...original, journey: {
    ...original.journey,
    notice: copy,
    hero: { ...original.journey.hero, body: copy },
  } };
});

import releaseConfig, { servedMedia } from '../../../deploy/shared-vps/vite.showcase.config';

describe('installed static release packaging', () => {
  const config = releaseConfig({ command: 'build', mode: 'production', isSsrBuild: false, isPreview: false });
  it('loads through the Vite config bundler, which has no "@/" alias, as the release build does', async () => {
    const file = fileURLToPath(new URL('../../../deploy/shared-vps/vite.showcase.config.ts', import.meta.url));
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, file, undefined, 'silent');
    expect(loaded?.config).toBeTruthy();
  }, 30000);
  it('resolves both Stripe entry points to the unavailable loader and preserves app aliases', async () => {
    const server = await createServer({ ...config, configFile: false,
      optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } });
    try {
      const stub = fileURLToPath(new URL('../../../deploy/shared-vps/stripe-showcase.mjs', import.meta.url));
      for (const source of ['@stripe/stripe-js', '@stripe/stripe-js/pure']) {
        const resolved = await server.pluginContainer.resolveId(source);
        expect(resolved?.id.replace(/\\/g, '/')).toBe(stub.replace(/\\/g, '/'));
      }
      const application = await server.pluginContainer.resolveId('@/content/journey');
      expect(application?.id.replace(/\\/g, '/')).toMatch(/\/src\/content\/journey\.ts$/);
    } finally { await server.close(); }
  });
  it('preserves literal dollar tokens while escaping fallback and description content', async () => {
    const plugin = config.plugins?.flat().find(item => item && typeof item === 'object' && 'name' in item && item.name === 'isolated-showcase-entry');
    if (!plugin || typeof plugin !== 'object' || !('transformIndexHtml' in plugin)) throw new Error('Missing release HTML transform');
    const transform = plugin.transformIndexHtml;
    if (!transform || typeof transform !== 'object' || !('handler' in transform)) throw new Error('Missing release HTML handler');
    const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    const result = await transform.handler(html, {} as IndexHtmlTransformContext);
    expect(typeof result).toBe('string');
    const output = result as string;
    const escaped = '&lt;tag&gt; &amp; &quot;quoted&quot; $&amp; $$ $1';
    expect(output).toContain(`<p>${escaped}</p>`);
    expect(output).toContain('class="release-shell"');
    expect(output).toContain('<noscript><p>');
    expect(output).toContain(`name="description" content="${escaped}"`);
    expect(output).toContain(`property="og:description" content="${escaped}"`);
    expect(output).not.toContain('<tag>');
  });
  describe('release media', () => {
    // Earlier realistic people and clay-figure media stay on disk for local previews but must never ship.
    const retired = ['continuity/clinician-v1.mp4', 'continuity/clinician-v1.webp', 'continuity/patient-v1.mp4',
      'continuity/patient-v1.webp', 'continuity/patient-v2.mp4', 'continuity/patient-v2.webp',
      'journey/connected-care-v1.mp4', 'journey/connected-care-v1.webp', 'journey/connected-care-blender-v1.mp4',
      'journey/connected-care-blender-v1.webp', 'journey/home-followup-v1.webp', 'journey/clinic-pilot-v1.mp4',
      'journey/clinic-pilot-v1.webp', 'journey/clinic-blockout-v1.webp', 'journey/clinic-home-blockout-v1.glb'];
    const plugin = config.plugins?.flat().find(item => item && typeof item === 'object' && 'name' in item && item.name === 'served-media-only');
    const writeBundle = (dir: string) => {
      if (!plugin || typeof plugin !== 'object' || !('writeBundle' in plugin) || typeof plugin.writeBundle !== 'function') throw new Error('Missing release media filter');
      (plugin.writeBundle as (options: { dir?: string }) => void)({ dir });
    };
    const release = (files: string[]) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'release-media-'));
      for (const file of files) {
        mkdirSync(path.dirname(path.join(dir, 'media', file)), { recursive: true });
        writeFileSync(path.join(dir, 'media', file), '');
      }
      return dir;
    };
    const servedFiles = [...servedMedia].map(url => url.replace(/^\/media\//, ''));
    it('names only existing, people-free journey media', () => {
      expect(servedFiles).toEqual(expect.arrayContaining([served.media.poster, served.media.homePoster].map(url => url.replace(/^\/media\//, ''))));
      for (const file of servedFiles) {
        expect(existsSync(new URL(`../../../public/media/${file}`, import.meta.url))).toBe(true);
        expect(retired).not.toContain(file);
      }
    });
    it('keeps served journey media and drops every other public media file', () => {
      const dir = release([...servedFiles, ...retired, 'cinematic/care-world-v1.glb']);
      try {
        writeBundle(dir);
        for (const file of servedFiles) expect(existsSync(path.join(dir, 'media', file))).toBe(true);
        for (const file of [...retired, 'cinematic/care-world-v1.glb']) expect(existsSync(path.join(dir, 'media', file))).toBe(false);
        expect(existsSync(path.join(dir, 'media', 'continuity'))).toBe(false);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
    it('fails the release when served media is missing', () => {
      const dir = release(retired);
      try {
        expect(() => writeBundle(dir)).toThrow(/Release media missing/);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
    it('keeps every retired file on disk for local previews', () => {
      for (const file of retired) expect(existsSync(new URL(`../../../public/media/${file}`, import.meta.url))).toBe(true);
    });
  });
  it('embeds critical scoped styling after asset processing using the current theme', () => {
    const plugin = config.plugins?.flat().find(item => item && typeof item === 'object' && 'name' in item && item.name === 'critical-release-shell');
    if (!plugin || typeof plugin !== 'object' || !('transformIndexHtml' in plugin)) throw new Error('Missing critical shell plugin');
    const transform = plugin.transformIndexHtml;
    if (!transform || typeof transform !== 'object' || !('handler' in transform)) throw new Error('Missing critical shell handler');
    expect(transform.order).toBe('post');
    const tags = transform.handler('', {} as IndexHtmlTransformContext);
    expect(tags).toEqual(expect.arrayContaining([expect.objectContaining({
      tag: 'style', injectTo: 'head-prepend', children: expect.stringContaining('min-height: 100svh'),
    })]));
  });
});
