import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const overrides = JSON.parse(fs.readFileSync(path.join(here, 'build-env.json'), 'utf8'));
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(here, 'vite.showcase.config.ts')], {
  cwd: root,
  env: { ...process.env, ...overrides },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
