// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServer } from 'vite';
import releaseConfig from '../../../deploy/connected/vite.connected.config';

describe('connected release packaging', () => {
  const config = releaseConfig({ command: 'build', mode: 'production', isSsrBuild: false, isPreview: false });
  it('resolves both installed Stripe entry points and preserves application aliases', async () => {
    const server = await createServer({ ...config, configFile: false,
      optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } });
    try {
      for (const source of ['@stripe/stripe-js', '@stripe/stripe-js/pure']) {
        const resolved = await server.pluginContainer.resolveId(source);
        expect(resolved?.id.replace(/\\/g, '/')).toContain('/@stripe/stripe-js/');
        expect(resolved?.id).not.toContain('stripe-showcase');
      }
      const application = await server.pluginContainer.resolveId('@/content/journey');
      expect(application?.id.replace(/\\/g, '/')).toMatch(/\/src\/content\/journey\.ts$/);
    } finally { await server.close(); }
  });
  it('keeps the public entry, root-relative assets and critical no-script fallback', () => {
    expect(config.base).toBe('/');
    const names = config.plugins?.flat().filter(Boolean).map(plugin => typeof plugin === 'object' && 'name' in plugin ? plugin.name : '');
    expect(names).toContain('isolated-showcase-entry');
    expect(names).toContain('critical-release-shell');
  });
});
