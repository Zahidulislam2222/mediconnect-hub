import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import preview from "../memory/mediconnect-release.json";
import { cinematic as c } from "./src/content/cinematic";

const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value]!);

export default defineConfig(environment => mergeConfig(baseConfig(environment), {
  base: "/",
  server: { host: "127.0.0.1", port: preview.local_preview_port, strictPort: true },
  build: { outDir: "dist-cinematic" },
  plugins: [{ name: "local-cinematic-preview", transformIndexHtml: { order: "pre", handler: (html: string) => html
    .replace("/src/main.tsx", "/src/cinematic-main.tsx")
    .replace('<div id="root"></div>', `<div id="root"><main><h1>${escape(c.hero.lines.join(" "))}</h1><p>${escape(c.hero.description)}</p><p>${escape(c.hero.footnote)}</p><p>${escape(c.auth.notice)}</p></main></div>`)
    .replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>/g, "")
    .replace(/<meta\b[^>]*(?:property="og:image"|name="twitter:(?:image|site)")[^>]*>/g, "")
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*("\s*\/>)/g, `$1${escape(c.hero.description)}$2`),
  } }],
}));
