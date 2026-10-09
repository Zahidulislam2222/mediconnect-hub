import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import baseConfig from '../../vite.config';
import { journey } from '../../src/content/journey';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const fallback = `<main class="release-shell"><header>${escapeHtml(journey.brand)}<span aria-hidden="true">.</span></header><section><h1>${escapeHtml(journey.hero.title)} <em>${escapeHtml(journey.hero.emphasis)}</em></h1><p>${escapeHtml(journey.hero.body)}</p><aside><p>${escapeHtml(journey.notice)}</p><noscript><p>${escapeHtml(journey.labels.noScript)}</p></noscript></aside></section></main>`;
// Read the existing theme rather than introducing a second brand palette.
const theme = readFileSync(path.resolve(__dirname, '../../src/index.css'), 'utf8');
const shellTokens = ['primary', 'primary-foreground', 'accent'].map(name => {
  const value = theme.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing shell theme token: ${name}`);
  return `--${name}:${value};`;
}).join('');
const shellStyles = readFileSync(path.resolve(__dirname, 'release-shell.css'), 'utf8');

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
  }, {
    name: 'critical-release-shell',
    // Post keeps critical CSS inside the HTML, independent of asset downloads.
    transformIndexHtml: { order: 'post', handler: () => [{
      tag: 'style', attrs: { id: 'release-shell-styles' },
      children: `.release-shell{${shellTokens}}${shellStyles}`, injectTo: 'head-prepend',
    }] },
  }],
  resolve: {
    alias: [{
      find: /^@stripe\/stripe-js(?:\/pure)?$/,
      replacement: path.resolve(__dirname, 'stripe-showcase.mjs'),
    }],
  },
}));
