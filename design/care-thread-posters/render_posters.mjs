// Renders the two shared still images from the live homepage illustrations.
//   node design/care-thread-posters/render_posters.mjs <origin>           write files that do not exist yet
//   node design/care-thread-posters/render_posters.mjs <origin> --force   also replace files that differ
//   node design/care-thread-posters/render_posters.mjs <origin> --check   compare with the files on disk
// <origin> is a copy of this site running on this computer (localhost), for example the dev server.
// The output paths come from `media` in the content file, sizes from posters.json beside this script.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const config = JSON.parse(await readFile(path.join(here, "posters.json"), "utf8"));
const content = JSON.parse(await readFile(path.join(root, config.contentFile), "utf8"));
const [origin, mode] = process.argv.slice(2);
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const isLocal = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && localHosts.includes(url.hostname);
  } catch {
    return false;
  }
};
if (!origin || !isLocal(origin) || (mode && !["--check", "--force"].includes(mode))) {
  console.error("usage: render_posters.mjs http://localhost:<port> [--check | --force]");
  process.exit(2);
}

/* Each stage lifts one live illustration to fill the window; the artwork itself is the site's own code.
   The only resizing is the last rule of each stage, which lets the sketch grow past its on-page cap. */
const stages = {
  clinic: { css: `
    .jy-home-clinician-image.jy-clinic-sketch {
      position: fixed; inset: 0; z-index: 2147483647;
      width: auto; height: auto; min-height: 0; border-radius: 0;
    }
    .jy-clinic-sketch .jy-clinic-sketch-art { font-size: min(1.95cqw, 3.5cqh); }
  ` },
  hero: { css: `
    .jy-hero { position: fixed; inset: 0; z-index: 2147483647; }
    .jy-hero-copy, .jy-hero-caption { display: none; }
    .jy-hero-inner {
      grid-template-columns: minmax(0, 1fr); justify-items: center; align-content: center;
      height: 100%; min-height: 0; max-width: none; padding: 0; gap: 0;
    }
    .jy-hero-canvas { margin-bottom: 20px; }
    .jy-hero-note { margin-inline: auto; text-align: center; }
    .jy-hero .jy-hero-thread { justify-self: center; width: 800px; max-width: none; }
  `,
    // A still outlives the page, so it carries the illustration note but not the site's current service notice.
    noteSelector: ".jy-hero-note", note: content.hero.illustrationNote },
};

const { viewport, output } = config;
const scale = output.width / viewport.width;
if (Math.round(viewport.height * scale) !== output.height) throw new Error("posters.json: viewport and output shapes differ");

const browser = await chromium.launch();
let failed = false;
try {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: "reduce" });
  // The page is this site only: anything that is not the given local address is refused.
  await context.route("**/*", (route) => {
    const url = route.request().url();
    return url.startsWith("data:") || new URL(url).origin === new URL(origin).origin ? route.continue() : route.abort();
  });
  for (const poster of config.posters) {
    const target = content.media[poster.mediaKey];
    if (!/^\/media\/[a-zA-Z0-9/_.-]+\.webp$/.test(target ?? "") || target.includes("..")) {
      throw new Error(`media.${poster.mediaKey} is not a .webp path under /media/`);
    }
    if (!stages[poster.stage]) throw new Error(`unknown stage: ${poster.stage}`);

    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "networkidle" });
    const stage = stages[poster.stage];
    await page.addStyleTag({ content: stage.css });
    await page.waitForSelector(poster.ready, { state: "attached" });
    if (stage.noteSelector) await page.locator(stage.noteSelector).evaluate((element, note) => { element.textContent = note; }, stage.note);
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png" });
    await page.close();

    // Encode with the same browser, so the only tool this needs is the project's own Playwright.
    const encoder = await context.newPage();
    const encoded = await encoder.evaluate(
      async ({ data, width, height, quality }) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        if (bitmap.width !== width || bitmap.height !== height) throw new Error(`captured ${bitmap.width}x${bitmap.height}`);
        const canvas = new OffscreenCanvas(width, height);
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/webp", quality })).arrayBuffer());
        let text = "";
        for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        return btoa(text);
      },
      { data: png.toString("base64"), width: output.width, height: output.height, quality: output.quality },
    );
    await encoder.close();

    const bytes = Buffer.from(encoded, "base64");
    const file = path.join(root, config.publicDirectory, target);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length > output.maxBytes) throw new Error(`${target}: ${bytes.length} bytes is over the ${output.maxBytes} limit`);
    const current = await readFile(file).catch(() => null);
    const same = current !== null && createHash("sha256").update(current).digest("hex") === hash;
    if (mode === "--check") {
      if (!same) failed = true;
      console.log(`${same ? "same     " : "DIFFERENT"} ${target} ${bytes.length} bytes sha256 ${hash}`);
    } else if (same) {
      console.log(`unchanged ${target} ${bytes.length} bytes sha256 ${hash}`);
    } else if (current !== null && mode !== "--force") {
      // A released picture keeps its bytes: give a new version a new file name, or pass --force while drafting.
      failed = true;
      console.log(`KEPT      ${target} exists and differs; not replaced without --force`);
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      console.log(`written   ${target} ${bytes.length} bytes sha256 ${hash}`);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
