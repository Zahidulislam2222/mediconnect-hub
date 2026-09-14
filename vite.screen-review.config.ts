import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import preview from "../memory/screen-review-preview.json";

export default defineConfig((environment) =>
  mergeConfig(baseConfig(environment), {
    base: preview.base,
    publicDir: false,
    cacheDir: preview.cacheDir,
    server: {
      host: preview.host,
      port: preview.port,
      strictPort: true,
      watch: { ignored: ["**/dist*/**", "**/design/**"] },
    },
    build: { outDir: preview.outDir, rollupOptions: { input: preview.entry } },
  }),
);
