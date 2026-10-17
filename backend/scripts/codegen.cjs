/**
 * Generates src/generated/HandlerRegistry.ts from src/root.yaml (Common Event Framework).
 *
 * Why not call the `cef-gen-handlers` bin directly? Its "is this the entry script?" check compares
 * `process.argv[1]` with its own path without resolving symlinks, so when launched through the
 * `node_modules/.bin` symlink (Linux, macOS, CI) it silently does nothing. Calling the exported
 * generator works identically on every platform.
 */
const path = require('node:path');
const { generateHandlerRegistry } = require('commoneventframework/dist/script/generateHandlerRegistry');

generateHandlerRegistry({
  cwd: path.resolve(__dirname, '..'),
  rootYaml: 'src/root.yaml',
  outFile: 'src/generated/HandlerRegistry.ts',
});
