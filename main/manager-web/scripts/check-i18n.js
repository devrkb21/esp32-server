const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
// The app speaks Bangla and English only (src/i18n/index.js). English is the base: every key of
// en.js must be in bn.js and the other way round. Page files (src/i18n/pages/*.js) carry both
// languages themselves and are checked by their own tests.
const locales = [
  { name: 'en', file: 'src/i18n/en.js' },
  { name: 'bn', file: 'src/i18n/bn.js' },
];

// A locale file may just re-export another one (`import en from './en'; export default en;`);
// it then has exactly the keys of that locale.
const ALIAS_RE = /^\s*import\s+(\w+)\s+from\s+['"]\.\/([\w-]+?)(?:\.js)?['"];?\s*export\s+default\s+\1;?\s*$/;

function readLocale(locale) {
  const filePath = path.join(rootDir, locale.file);
  const source = fs.readFileSync(filePath, 'utf8');
  const alias = source.match(ALIAS_RE);
  if (alias) {
    const target = locales.find((other) => other.name === alias[2]);
    if (target && target !== locale) {
      return { ...readLocale(target), ...locale, filePath, duplicates: [], aliasOf: target.name };
    }
  }
  const lines = source.split(/\r?\n/);
  const keys = [];
  const seen = new Map();
  const duplicates = [];

  lines.forEach((line, index) => {
    const match = line.match(/^\s*['"]([^'"]+)['"]\s*:/);
    if (!match) {
      return;
    }

    const key = match[1];
    keys.push(key);
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key).push(index + 1);
  });

  seen.forEach((lineNumbers, key) => {
    if (lineNumbers.length > 1) {
      duplicates.push({ key, lineNumbers });
    }
  });

  return {
    ...locale,
    filePath,
    keys,
    keySet: new Set(keys),
    duplicates,
  };
}

function diffKeys(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

function formatKeyList(keys) {
  return keys.length ? keys.map((key) => `    - ${key}`).join('\n') : '';
}

function main() {
  const results = locales.map(readLocale);
  const base = results.find((locale) => locale.name === 'en');
  const errors = [];

  results.forEach((locale) => {
    locale.duplicates.forEach(({ key, lineNumbers }) => {
      errors.push(
        `${locale.file} has duplicate key "${key}" on lines ${lineNumbers.join(', ')}`
      );
    });
  });

  results
    .filter((locale) => locale !== base)
    .forEach((locale) => {
      const missing = diffKeys(base.keySet, locale.keySet);
      const extra = diffKeys(locale.keySet, base.keySet);

      if (missing.length) {
        errors.push(`${locale.file} is missing keys from ${base.file}:\n${formatKeyList(missing)}`);
      }

      if (extra.length) {
        errors.push(`${locale.file} has keys that do not exist in ${base.file}:\n${formatKeyList(extra)}`);
      }
    });

  // Each page file: the same keys in its bn and en tables, no key twice in one table.
  const pagesDir = path.join(rootDir, 'src/i18n/pages');
  let pageCount = 0;
  fs.readdirSync(pagesDir).filter((f) => f.endsWith('.js')).sort().forEach((f) => {
    pageCount += 1;
    const rel = `src/i18n/pages/${f}`;
    const tables = {};
    let current = null;
    fs.readFileSync(path.join(pagesDir, f), 'utf8').split(/\r?\n/).forEach((line, index) => {
      const open = line.match(/^\s{2}(\w+):\s*\{/);
      if (open) { current = open[1]; tables[current] = tables[current] || new Map(); return; }
      if (/^\s{2}\},?\s*$/.test(line)) { current = null; return; }
      const key = current && line.match(/^\s*['"]([^'"]+)['"]\s*:/);
      if (!key) return;
      if (tables[current].has(key[1])) errors.push(`${rel} has duplicate ${current} key "${key[1]}" on line ${index + 1}`);
      tables[current].set(key[1], index + 1);
    });
    if (!tables.bn || !tables.en) { errors.push(`${rel} needs both a bn and an en table`); return; }
    const bnKeys = new Set(tables.bn.keys());
    const enKeys = new Set(tables.en.keys());
    const missingBn = diffKeys(enKeys, bnKeys);
    const missingEn = diffKeys(bnKeys, enKeys);
    if (missingBn.length) errors.push(`${rel} bn is missing keys of en:\n${formatKeyList(missingBn)}`);
    if (missingEn.length) errors.push(`${rel} en is missing keys of bn:\n${formatKeyList(missingEn)}`);
  });

  if (errors.length) {
    console.error(`i18n check failed with ${errors.length} issue(s):`);
    console.error(errors.join('\n\n'));
    process.exit(1);
  }

  const keyCount = base.keySet.size;
  console.log(`i18n check passed: ${results.length} locale files, ${keyCount} keys each; ${pageCount} page files in bn and en.`);
}

main();
