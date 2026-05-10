import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const rootDir = resolve(appDir, '../..');
const binDir = getBinDir();

mkdirSync(binDir, { recursive: true });

if (process.platform === 'win32') {
  const target = join(binDir, 'bctxd.cmd');
  rmSync(target, { force: true });
  writeFileSync(target, getWindowsShim());
} else {
  const target = join(binDir, 'bctxd');
  rmSync(target, { force: true });
  writeFileSync(target, getPosixShim());
  chmodSync(target, 0o755);
}

function getBinDir() {
  if (process.env.BCTX_DEV_BIN_DIR) {
    return process.env.BCTX_DEV_BIN_DIR;
  }

  if (process.platform === 'win32') {
    return getNpmPrefix() ?? join(homedir(), 'AppData', 'Roaming', 'npm');
  }

  return join(homedir(), '.local', 'bin');
}

function getNpmPrefix() {
  try {
    return execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['config', 'get', 'prefix'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    return null;
  }
}

function getPosixShim() {
  return `#!/usr/bin/env sh
set -eu
export BCTX_PROG_NAME=bctxd
export BCTX_ORIGINAL_CWD="$PWD"
exec pnpm --dir ${shellQuote(rootDir)} --filter branch-context exec tsx --conditions=development ${shellQuote(join(appDir, 'src', 'index.ts'))} "$@"
`;
}

function getWindowsShim() {
  return `@echo off
set "BCTX_PROG_NAME=bctxd"
set "BCTX_ORIGINAL_CWD=%CD%"
pnpm --dir "${rootDir}" --filter branch-context exec tsx --conditions=development "${join(appDir, 'src', 'index.ts')}" %*
`;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
