import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitOutput } from './command';

export function gitAdd(path: string, files = '.'): SpawnSyncReturns<string> {
  return spawnSync('git', ['add', files], { cwd: path, encoding: 'utf8' });
}

export function gitCommit(path: string, message: string): SpawnSyncReturns<string> {
  return spawnSync('git', ['commit', '-m', message], { cwd: path, encoding: 'utf8' });
}

export function gitCheckout(
  path: string,
  branch: string,
  create = false,
): SpawnSyncReturns<string> {
  const args = ['checkout'];
  if (create) {
    args.push('-b');
  }
  args.push(branch);
  return spawnSync('git', args, { cwd: path, encoding: 'utf8' });
}

export function gitCurrentBranch(path: string): string | null {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: path,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  const headFile = join(path, '.git', 'HEAD');
  try {
    const content = readFileSync(headFile, 'utf8').trim();
    if (content.startsWith('ref: refs/heads/')) {
      return content.slice(16);
    }
  } catch {}

  return null;
}

export function gitDeleteBranch(path: string, branch: string, force = false): boolean {
  const flag = force ? '-D' : '-d';
  const result = spawnSync('git', ['branch', flag, branch], {
    cwd: path,
    encoding: 'utf8',
  });
  return result.status === 0;
}

export function gitListBranches(path: string): string[] {
  const result = spawnSync('git', ['branch', '--format=%(refname:short)'], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .trim()
    .split('\n')
    .map((branch) => branch.trim())
    .filter(Boolean);
}

export function gitListRemoteBranches(path: string, remote = 'origin'): string[] {
  const result = spawnSync('git', ['branch', '-r', '--format=%(refname:short)'], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return [];
  }

  const prefix = `${remote}/`;
  return result.stdout
    .trim()
    .split('\n')
    .map((branch) => branch.trim())
    .filter((branch) => branch.startsWith(prefix) && !branch.endsWith('/HEAD'))
    .map((branch) => branch.slice(prefix.length));
}

export function gitCommitParentRef(path: string, commitHash: string): string | null {
  const result = spawnSync('git', ['rev-list', '--parents', '-n', '1', commitHash], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }

  const [, parent] = result.stdout.trim().split(/\s+/);
  return parent ?? '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
}

export function gitMergeBase(path: string, leftRef: string, rightRef = 'HEAD'): string | null {
  return gitOutput(path, ['merge-base', leftRef, rightRef])?.trim() || null;
}

export function gitRefExists(path: string, ref: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: path,
    encoding: 'utf8',
  });
  return result.status === 0;
}
