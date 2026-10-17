// Copies non-TypeScript runtime assets next to the compiled output.
// The Common Event Framework resolves `root.yaml` from the entry script's directory (dist/).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = [['src/root.yaml', 'dist/root.yaml']];

for (const [from, to] of assets) {
  mkdirSync(dirname(resolve(root, to)), { recursive: true });
  copyFileSync(resolve(root, from), resolve(root, to));
  console.log(`[build] copied ${from} -> ${to}`);
}
