/**
 * Bundles the API into a single-file AWS Lambda artifact with the Common Event Framework builder
 * (esbuild): dist/index.js + dist/root.yaml + dist/package.json, zipped into dist/dist.zip.
 *
 * Deploy dist/dist.zip with handler `index.handler` behind an API Gateway HTTP API (v2).
 */
const fs = require('node:fs');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');

// Codegen already ran via scripts/codegen.cjs (see the npm script); `--full` also creates the zip.
process.argv.push('--skip-codegen', '--full');
require('commoneventframework/dist/script/build');
