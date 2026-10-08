import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig from '../../vite.config';
import { journey } from '../../src/content/journey';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const fallback = `<main><h1>${escapeHtml(journey.brand)}</h1><h2>${escapeHtml(journey.hero.title)} ${escapeHtml(journey.hero.emphasis)}</h2><p>${escapeHtml(journey.hero.body)}</p><p>${escapeHtml(journey.notice)}</p><p>${escapeHtml(journey.labels.noScript)}</p></main>`;

export default defineConfig((environment) => mergeConfig(baseConfig(environment), {
  // Root-relative assets are required for direct navigation to nested SPA routes.
  base: '/',
  plugins: [{
    name: 'isolated-showcase-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html
        .replace('/src/main.tsx', '/src/showcase-main.tsx')
        .replace('<div id="root"></div>', () => `<div id="root">${fallback}</div>`)
        // Self-contained system typography: no external fonts or template branding.
        .replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>/g, '')
        .replace(/<meta\b[^>]*(?:property="og:image"|name="twitter:(?:image|site)")[^>]*>/g, '')
        .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*("\s*\/>)/g, (_match, prefix: string, suffix: string) => `${prefix}${escapeHtml(journey.hero.body)}${suffix}`)
        .replace('content="summary_large_image"', 'content="summary"'),
    },
  }],
  resolve: {
    alias: [{
      find: /^@stripe\/stripe-js(?:\/pure)?$/,
      replacement: path.resolve(__dirname, 'stripe-showcase.mjs'),
    }],
  },
}));
