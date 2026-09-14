import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const boundary = 'src/config/env.ts';
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json']);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bgh[pousr]_[0-9A-Za-z]{36,}\b/,
];

function property(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
}

function unwrap(node) {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
}

function isEnvironment(node) {
  node = unwrap(node);
  if (property(node) !== 'env') return false;
  const owner = unwrap(node.expression);
  return ts.isMetaProperty(owner) || (ts.isIdentifier(owner) && owner.text === 'process');
}

export function inspectSource(name, content) {
  const failures = [];
  if (secretPatterns.some(pattern => pattern.test(content))) failures.push(`${name}: obvious secret pattern`);
  if (name.endsWith('.json')) return failures;
  const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) failures.push(`${name}: source could not be parsed`);
  function visit(node) {
    if (name !== boundary && ts.isImportDeclaration(node) &&
        ['process', 'node:process'].includes(node.moduleSpecifier.text)) {
      failures.push(`${name}: process import bypasses ${boundary}`);
    }
    if (ts.isMetaProperty(node) || (ts.isIdentifier(node) && node.text === 'process')) {
      let parent = node.parent;
      while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))) parent = parent.parent;
      const allowed = ts.isMetaProperty(node) && ['url', 'glob'].includes(property(parent));
      const processMethod = ts.isIdentifier(node) && property(parent) === 'cwd';
      const ownedEnvironment = name === boundary && property(parent) === 'env';
      if (!allowed && !processMethod && !ownedEnvironment) failures.push(`${name}: environment owner alias bypasses ${boundary}`);
    }
    // Detect the environment object itself, so assigning or destructuring it
    // cannot hide later accesses behind an alias.
    if (name !== boundary && isEnvironment(node)) failures.push(`${name}: environment access bypasses ${boundary}`);
    if (name !== boundary && ts.isVariableDeclaration(node) && node.initializer) {
      const owner = node.initializer;
      if ((ts.isMetaProperty(owner) || (ts.isIdentifier(owner) && owner.text === 'process')) &&
          (ts.isIdentifier(node.name) || (ts.isObjectBindingPattern(node.name) && node.name.elements.some(element => (element.propertyName ?? element.name).getText(source) === 'env')))) {
        failures.push(`${name}: environment destructuring bypasses ${boundary}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(failures)];
}

export function auditFrontend(root) {
  const failures = [];
  let files = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Source symlinks require explicit audit coverage');
      if (entry.isDirectory()) walk(full);
      else if (extensions.has(path.extname(entry.name))) {
        files++;
        failures.push(...inspectSource(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')));
      }
    }
  }
  walk(path.join(root, 'src'));
  const config = fs.readFileSync(path.join(root, boundary), 'utf8');
  const environment = auditEnvironment(config, fs.readFileSync(path.join(root, '.env.example'), 'utf8'));
  failures.push(...environment.failures);
  return { files, variables: environment.variables, failures };
}

export function auditEnvironment(config, example) {
  const failures = inspectSource(boundary, config);
  const declared = new Set([...((config.match(/PUBLIC_ENV_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/) ?? [])[1] ?? '').matchAll(/["'](VITE_[A-Z0-9_]+)["']/g)].map(match => match[1]));
  const mapped = new Set([...config.matchAll(/^\s*(VITE_[A-Z0-9_]+):\s*import\.meta\.env\.\1\s*,?$/gm)].map(match => match[1]));
  const documented = new Set([...example.matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map(match => match[1]));
  const referenced = new Set();
  const source = ts.createSourceFile(boundary, config, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (isEnvironment(node)) {
      const name = property(node.parent);
      if (name?.startsWith('VITE_')) referenced.add(name);
      else if (!['MODE', 'PROD', 'DEV', 'SSR', 'BASE_URL'].includes(name)) failures.push('Configuration owner contains a dynamic or aliased environment access');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!declared.size) failures.push('Public environment declaration is missing');
  for (const name of new Set([...declared, ...mapped, ...documented, ...referenced])) {
    if (!declared.has(name)) failures.push(`${name}: missing typed declaration`);
    if (!mapped.has(name)) failures.push(`${name}: missing static Vite mapping`);
    if (!documented.has(name)) failures.push(`${name}: missing .env.example documentation`);
  }
  return { variables: declared.size, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditFrontend(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  for (const failure of result.failures) console.error(failure);
  console.log(`Frontend configuration audit: ${result.files} source/data files, ${result.variables} variables, ${result.failures.length} failures`);
  process.exitCode = result.failures.length ? 1 : 0;
}
