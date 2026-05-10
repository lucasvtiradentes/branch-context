import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(SCRIPT_DIR, '..', '..');

export const READMES = {
  main: resolve(ROOT_DIR, 'README.md'),
  cli: resolve(ROOT_DIR, 'apps/cli/README.md'),
  vscodeExtension: resolve(ROOT_DIR, 'apps/vscode-extension/README.md'),
} as const;
