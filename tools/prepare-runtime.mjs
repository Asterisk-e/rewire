import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const vendorDir = join(root, 'vendor');
await mkdir(vendorDir, { recursive: true });

let resolvedEntry;
try {
  resolvedEntry = require.resolve('@huggingface/transformers');
} catch {
  throw new Error('Missing @huggingface/transformers. Run npm install while online, then run npm run prepare:offline.');
}
let transformersRoot = dirname(resolvedEntry);
let packageJsonPath = null;
for (let depth = 0; depth < 6; depth++) {
  const candidate = join(transformersRoot, 'package.json');
  try {
    const metadata = JSON.parse(await readFile(candidate, 'utf8'));
    if (metadata.name === '@huggingface/transformers') { packageJsonPath = candidate; break; }
  } catch { /* walk to parent */ }
  transformersRoot = dirname(transformersRoot);
}
if (!packageJsonPath) throw new Error('Could not locate the installed @huggingface/transformers package root.');
transformersRoot = dirname(packageJsonPath);
const transformerCandidates = [
  join(transformersRoot, 'dist', 'transformers.min.js'),
  join(transformersRoot, 'dist', 'transformers.web.min.js'),
  join(transformersRoot, 'dist', 'transformers.js')
];
let transformerEntry = null;
for (const candidate of transformerCandidates) {
  try { if ((await stat(candidate)).isFile()) { transformerEntry = candidate; break; } } catch { /* try next */ }
}
if (!transformerEntry) {
  const metadata = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const exported = typeof metadata.exports === 'string' ? metadata.exports : metadata.exports?.['.']?.browser || metadata.exports?.['.']?.import;
  if (typeof exported === 'string') {
    const candidate = resolve(transformersRoot, exported.replace(/^\.\//, ''));
    try { if ((await stat(candidate)).isFile()) transformerEntry = candidate; } catch { /* report below */ }
  }
}
if (!transformerEntry) throw new Error('Could not locate the browser ESM build in the installed Transformers.js package. Inspect node_modules/@huggingface/transformers/dist and update tools/prepare-runtime.mjs for that package release.');

await copyFile(transformerEntry, join(vendorDir, 'transformers.min.js'));

// ONNX Runtime Web may be a dependency of Transformers.js or bundled in its own dist folder.
const possibleRoots = [
  resolve(transformersRoot, '..', 'onnxruntime-web', 'dist'),
  resolve(transformersRoot, '..', '..', 'onnxruntime-web', 'dist'),
  join(transformersRoot, 'dist')
];
let copied = 0;
const seen = new Set();
for (const folder of possibleRoots) {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); } catch { continue; }
  for (const entry of entries) {
    if (!entry.isFile() || !/^ort-wasm.*\.(?:wasm|mjs|js)$/.test(entry.name) || seen.has(entry.name)) continue;
    seen.add(entry.name);
    await copyFile(join(folder, entry.name), join(vendorDir, entry.name));
    copied++;
  }
}
console.log(`Prepared browser runtime in ${vendorDir}`);
console.log(`Copied Transformers.js ESM entry and ${copied} ONNX Runtime Web asset(s).`);
console.log('Keep vendor/ in the project when using the app offline.');
