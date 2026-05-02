import { execFileSync, type SpawnSyncReturns, spawnSync } from 'node:child_process';

export function gitInit(path: string, branch?: string): SpawnSyncReturns<string> {
  const args = ['init'];
  if (branch) {
    args.push('-b', branch);
  }
  return spawnSync('git', args, { cwd: path, encoding: 'utf8' });
}

export function gitRoot(path = process.cwd()): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: path,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}
