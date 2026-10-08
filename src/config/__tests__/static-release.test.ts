// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createServer, type IndexHtmlTransformContext } from 'vite';
type JourneyModule = typeof import('../../content/journey');

vi.mock('../../content/journey', async importOriginal => {
  const original = await importOriginal<JourneyModule>();
  const copy = '<tag> & "quoted" $& $$ $1';
  return { ...original, journey: {
    ...original.journey,
    notice: copy,
    hero: { ...original.journey.hero, body: copy },
  } };
});

import releaseConfig from '../../../deploy/shared-vps/vite.showcase.config';

describe('installed static release packaging', () => {
  const config = releaseConfig({ command: 'build', mode: 'production', isSsrBuild: false, isPreview: false });
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
    expect(output).toContain(`name="description" content="${escaped}"`);
    expect(output).toContain(`property="og:description" content="${escaped}"`);
    expect(output).not.toContain('<tag>');
  });
});
