import { execFileSync, type SpawnSyncReturns, spawnSync } from 'node:child_process';

export function gitWorktreeDirty(workspaceRoot: string): boolean {
  const output = execFileSync('git', ['status', '--porcelain'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  return output.trim().length > 0;
}

export function gitRestoreFromCommit(
  workspaceRoot: string,
  hash: string,
): SpawnSyncReturns<string> {
  return spawnSync('git', ['restore', `--source=${hash}`, '.'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
}
