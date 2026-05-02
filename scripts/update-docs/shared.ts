import { resolve } from 'node:path';

export const ROOT_DIR = resolve(__dirname, '..', '..');

export const READMES = {
  main: resolve(ROOT_DIR, 'README.md'),
  cli: resolve(ROOT_DIR, 'apps/cli/README.md'),
  vscodeExtension: resolve(ROOT_DIR, 'apps/vscode-extension/README.md'),
} as const;
