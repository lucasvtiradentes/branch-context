import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const binDir = getBinDir();

rmSync(join(binDir, 'bctxd'), { force: true });
rmSync(join(binDir, 'bctxd.cmd'), { force: true });

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
