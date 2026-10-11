import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { parsePublicSettingsJson, connectedContentSecurityPolicy, connectedViteEnvironment } from './runtime-settings.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const [input, destination, ...extra] = process.argv.slice(2);
if (!input || !destination || extra.length) throw new Error('Usage: node deploy/connected/build-connected.mjs PUBLIC_CONFIG_JSON OUTPUT_DIRECTORY');
const output = path.resolve(destination);
const relative = path.relative(root, output);
if (!relative.startsWith('local-tests' + path.sep) || existsSync(output)) throw new Error('A fresh ignored local-tests output directory is required');
const ignored = spawnSync('git', ['check-ignore', '--quiet', path.join(relative, 'probe')], { cwd: root });
if (ignored.status !== 0) throw new Error('Output exclusion is not verified');
const settings = parsePublicSettingsJson(readFileSync(input, 'utf8'));
const csp = connectedContentSecurityPolicy(settings);
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'public-build-settings.json'), JSON.stringify(settings, null, 2));
writeFileSync(path.join(output, 'content-security-policy.txt'), csp + '\n');
writeFileSync(path.join(output, 'status.json'), JSON.stringify({ status: 'BUILDING', activated: false }));
try {
  await build({ root, configFile: path.join(root, 'deploy/connected/vite.connected.config.ts'),
    ...connectedViteEnvironment(settings), build: { outDir: path.join(output, 'dist'), emptyOutDir: false } });
} catch {
  writeFileSync(path.join(output, 'status.json'), JSON.stringify({ status: 'BUILD_FAILED', activated: false }));
  throw new Error('Connected compilation failed; inspect build output');
}
/** @param {string} directory @returns {string[]} */
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const manifest = Object.fromEntries(files(path.join(output, 'dist')).map(file => [path.relative(output, file).replaceAll('\\', '/'),
  createHash('sha256').update(readFileSync(file)).digest('hex')]));
writeFileSync(path.join(output, 'artifact-manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(path.join(output, 'status.json'), JSON.stringify({ status: 'BUILT_NOT_ACTIVATED', files: Object.keys(manifest).length,
  activated: false, providerAcceptance: 'PENDING', endpointRuntimeAcceptance: 'PENDING' }, null, 2));
console.log('Connected local artifact built; no activation or provider acceptance claimed.');
