import { expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditEnvironment, auditFrontend, inspectSource } from '../../scripts/verify_frontend_config.mjs';

it.each([
  'const value = import.meta.env.VITE_TEST;',
  'const value = import.meta["env"]["VITE_TEST"];',
  'const alias = import.meta.env;',
  'const { VITE_TEST } = import.meta.env;',
  'const { env: alias } = import.meta;',
  'const value = process.env.VITE_TEST;',
  'const { env } = process;',
  'const meta = import.meta; const value = meta.env;',
  'const alias = process; const value = alias.env;',
  'const value = (import.meta).env.VITE_TEST;',
  'let meta; meta = import.meta; const value = meta.env;',
  'import runtime from "node:process"; const value = runtime.env;',
  'let runtime; runtime = process; const value = runtime.env.VITE_TEST;',
  'const runtime = (process); const value = runtime.env.VITE_TEST;',
])('rejects direct or aliased environment access: %s', source => {
  expect(inspectSource('src/feature.ts', source)).toContainEqual(expect.stringContaining('bypasses'));
});

it('allows comments, protocol strings and the one configuration owner', () => {
  expect(inspectSource('src/feature.ts', '// import.meta.env.VITE_TEST\nconst value = "test-key";')).toEqual([]);
  expect(inspectSource('src/config/env.ts', 'const value = import.meta.env.VITE_TEST;')).toEqual([]);
  expect(inspectSource('src/tool.test.ts', 'const root = process.cwd();')).toEqual([]);
  expect(inspectSource('src/tool.test.ts', 'const sources = import.meta.glob("./*.tsx", { query: "?raw" });')).toEqual([]);
});

it('rejects a synthetic private-key marker without disclosing its contents', () => {
  const synthetic = ['-----BEGIN ', 'PRIVATE KEY-----', '\ntest-only'].join('');
  const findings = inspectSource('src/example.json', JSON.stringify({ value: synthetic }));
  expect(findings).toEqual(['src/example.json: obvious secret pattern']);
});

it('audits the actual repository source and documented typed configuration', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const result = auditFrontend(root);
  expect(result.files).toBeGreaterThan(0);
  expect(result.variables).toBeGreaterThan(0);
  expect(result.failures).toEqual([]);
});

it('requires each public name in the typed declaration, static mapping and example', () => {
  const declaration = 'export const PUBLIC_ENV_NAMES = ["VITE_TEST"] as const;\n';
  const mapping = 'const values = {\n VITE_TEST: import.meta.env.VITE_TEST,\n};\n';
  expect(auditEnvironment(declaration + mapping, 'VITE_TEST=test-value').failures).toEqual([]);
  expect(auditEnvironment(declaration + mapping, '').failures).toContain('VITE_TEST: missing .env.example documentation');
  expect(auditEnvironment(declaration, 'VITE_TEST=test-value').failures).toContain('VITE_TEST: missing static Vite mapping');
  expect(auditEnvironment(mapping, 'VITE_TEST=test-value').failures).toContain('VITE_TEST: missing typed declaration');
  expect(auditEnvironment(declaration + mapping + 'const extra = import.meta.env.VITE_UNDOCUMENTED;', 'VITE_TEST=test-value').failures).toContain('VITE_UNDOCUMENTED: missing typed declaration');
  expect(auditEnvironment(declaration + mapping + 'const meta = import.meta; const extra = meta.env.VITE_UNDOCUMENTED;', 'VITE_TEST=test-value').failures).toContainEqual(expect.stringContaining('bypasses'));
});
