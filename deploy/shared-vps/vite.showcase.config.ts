import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig from '../../vite.config';
import { showcase } from '../../src/content/showcase';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const fallback = `<main><h1>${escapeHtml(showcase.brand)}</h1><h2>${escapeHtml(showcase.hero.title)}</h2><p>${escapeHtml(showcase.hero.description)}</p><p>${escapeHtml(showcase.hero.disclaimer)}</p><p>${escapeHtml(showcase.faq.items[0].answer)}</p></main>`;

export default defineConfig((environment) => mergeConfig(baseConfig(environment), {
  // Root-relative assets are required for direct navigation to nested SPA routes.
  base: '/',
  plugins: [{
    name: 'isolated-showcase-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html
        .replace('/src/main.tsx', '/src/showcase-main.tsx')
        .replace('<div id="root"></div>', `<div id="root">${fallback}</div>`)
        // Self-contained system typography: no external fonts or template branding.
        .replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>/g, '')
        .replace(/<meta\b[^>]*(?:property="og:image"|name="twitter:(?:image|site)")[^>]*>/g, '')
        .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*("\s*\/>)/g, `$1${escapeHtml(showcase.edition)}$2`)
        .replace('content="summary_large_image"', 'content="summary"'),
    },
  }],
  resolve: {
    alias: {
      '@stripe/stripe-js': path.resolve(__dirname, 'stripe-showcase.mjs'),
    },
  },
}));
