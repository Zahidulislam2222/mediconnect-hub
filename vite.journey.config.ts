import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import preview from "../memory/journey-preview.json";
import { journey as c } from "./src/content/journey";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export default defineConfig((environment) =>
  mergeConfig(baseConfig(environment), {
    base: "/",
    cacheDir: preview.cacheDir,
    server: {
      host: preview.host,
      port: preview.port,
      strictPort: true,
      watch: { ignored: preview.watchIgnored },
    },
    preview: { host: preview.host, port: preview.buildPort, strictPort: true },
    build: { outDir: preview.outDir },
    plugins: [
      {
        name: "local-connected-journey",
        transformIndexHtml: {
          order: "pre",
          handler: (html: string) =>
            html
              .replace("/src/main.tsx", "/src/journey-main.tsx")
              .replace(
                /<title>.*?<\/title>/,
                `<title>${escape(c.brand)} — ${escape(c.tagline)}</title>`,
              )
              .replace(
                '<div id="root"></div>',
                `<div id="root"><main><h1>${escape(c.hero.title)} ${escape(c.hero.emphasis)}</h1><p>${escape(c.hero.body)}</p><p>${escape(c.notice)}</p><noscript>${escape(c.labels.noScript)}</noscript></main></div>`,
              )
              .replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>/g, "")
              .replace(
                /<meta\b[^>]*(?:property="og:image"|name="twitter:(?:image|site)")[^>]*>/g,
                "",
              ),
        },
      },
    ],
  }),
);
