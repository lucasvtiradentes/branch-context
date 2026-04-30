import { execFileSync, type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function gitInit(path: string, branch?: string): SpawnSyncReturns<string> {
  const args = ['init'];
  if (branch) {
    args.push('-b', branch);
  }
  return spawnSync('git', args, { cwd: path, encoding: 'utf8' });
}

export function gitConfig(path: string, key: string, value: string): SpawnSyncReturns<string> {
  return spawnSync('git', ['config', key, value], { cwd: path, encoding: 'utf8' });
}

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

export function gitConfigGet(
  key: string,
  options: { scope?: 'global'; path?: string } = {},
): string | null {
  const args = ['config'];
  if (options.scope === 'global') {
    args.push('--global');
  }
  args.push(key);

  const result = spawnSync('git', args, {
    cwd: options.path,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  return null;
}

export function gitUserName(path?: string): string | null {
  return gitConfigGet('user.name', { path });
}

export function gitConfigUnset(key: string, scope?: 'global'): boolean {
  const args = ['config', '--unset'];
  if (scope === 'global') {
    args.splice(1, 0, '--global');
  }
  args.push(key);

  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0;
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

export function gitHooksPath(path: string): string | null {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export function gitInfoExcludeAdd(path: string, pattern: string): boolean {
  const excludeFile = join(path, '.git', 'info', 'exclude');

  try {
    let existing = '';
    if (existsSync(excludeFile)) {
      existing = readFileSync(excludeFile, 'utf8');
    }

    if (existing.split(/\r?\n/).includes(pattern)) {
      return true;
    }

    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(excludeFile, `${existing}${prefix}${pattern}\n`);
    return true;
  } catch {
    return false;
  }
}

export function gitLog(path: string, args: string[]): string | null {
  const result = spawnSync('git', ['log', ...args], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}

export function gitDiff(path: string, args: string[]): string | null {
  const result = spawnSync('git', ['diff', ...args], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}
