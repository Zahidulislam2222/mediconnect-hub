import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import preview from "../memory/continuity-preview.json";
import { continuity as c } from "./src/content/continuity";

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (value) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        value
      ]!,
  );

export default defineConfig((environment) =>
  mergeConfig(baseConfig(environment), {
    base: "/",
    cacheDir: preview.cacheDir,
    preview: { host: preview.host, port: preview.buildPort, strictPort: true },
    server: { host: preview.host, port: preview.port, strictPort: true, watch: { ignored: preview.watchIgnored } },
    build: { outDir: preview.outDir },
    plugins: [
      {
        name: "local-continuity-preview",
        transformIndexHtml: {
          order: "pre",
          handler: (html: string) =>
            html
              .replace("/src/main.tsx", "/src/continuity-main.tsx")
              .replace(
                /<title>.*?<\/title>/,
                `<title>${escape(c.brand)} — ${escape(c.hero.title)}</title>`,
              )
              .replace(
                '<div id="root"></div>',
                `<div id="root"><main><h1>${escape(c.hero.title)} ${escape(c.hero.emphasis)}</h1><p>${escape(c.hero.description)}</p><p>${escape(c.notice)}</p><noscript>${escape(c.noScript)}</noscript></main></div>`,
              )
              .replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>/g, "")
              .replace(
                /<meta\b[^>]*(?:property="og:image"|name="twitter:(?:image|site)")[^>]*>/g,
                "",
              )
              .replace(
                /(<meta (?:name="description"|property="og:description") content=")[^"]*("\s*\/>)/g,
                `$1${escape(c.hero.description)}$2`,
              ),
        },
      },
    ],
  }),
);
