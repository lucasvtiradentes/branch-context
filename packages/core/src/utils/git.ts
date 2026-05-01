import { execFileSync, type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type GitChangedFileSummary = {
  status: string;
  path: string;
  oldPath: string | null;
  additions: number | null;
  deletions: number | null;
};

export type GitCommitSummary = {
  shortHash: string;
  hash: string;
  subject: string;
  authoredAt: string;
  authorName: string;
};

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

export function gitShow(path: string, args: string[]): string | null {
  const result = spawnSync('git', ['show', ...args], {
    cwd: path,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}

export function gitFileContent(path: string, ref: string, filePath: string): string | null {
  return gitShow(path, [`${ref}:${filePath}`]);
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
  const result = spawnSync('git', ['merge-base', leftRef, rightRef], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

export function gitChangedFileSummaries(path: string, baseRef: string): GitChangedFileSummary[] {
  const statusOutput = gitDiff(path, ['--name-status', '-M100', `${baseRef}...HEAD`]);
  const numstatOutput = gitDiff(path, ['--numstat', '-M100', `${baseRef}...HEAD`]);

  if (!statusOutput) {
    return [];
  }

  const stats = parseNumstat(numstatOutput ?? '');
  return statusOutput
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => parseNameStatusLine(line, stats));
}

export function gitChangedFileSummariesBetween(
  path: string,
  leftRef: string,
  rightRef: string,
): GitChangedFileSummary[] {
  const statusOutput = gitDiff(path, ['--name-status', '-M100', leftRef, rightRef]);
  const numstatOutput = gitDiff(path, ['--numstat', '-M100', leftRef, rightRef]);

  if (!statusOutput) {
    return [];
  }

  const stats = parseNumstat(numstatOutput ?? '');
  return statusOutput
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => parseNameStatusLine(line, stats));
}

export function gitCommitSummaries(path: string, baseRef: string, limit = 50): GitCommitSummary[] {
  const output = gitLog(path, [
    `${baseRef}..HEAD`,
    `--max-count=${limit}`,
    '--format=%h%x1f%H%x1f%s%x1f%aI%x1f%an',
  ]);

  if (!output) {
    return [];
  }

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const [shortHash, hash, subject, authoredAt, authorName] = line.split('\x1f');
      if (!shortHash || !hash || !subject || !authoredAt || !authorName) {
        return [];
      }
      return [{ shortHash, hash, subject, authoredAt, authorName }];
    });
}

export function gitRefExists(path: string, ref: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: path,
    encoding: 'utf8',
  });
  return result.status === 0;
}

function parseNumstat(output: string) {
  const stats = new Map<string, Pick<GitChangedFileSummary, 'additions' | 'deletions'>>();

  for (const line of output.trim().split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const filePath = parts.length === 3 ? parts[2] : parts[3];
    if (!filePath) {
      continue;
    }

    stats.set(filePath, {
      additions: parseStatCount(parts[0]),
      deletions: parseStatCount(parts[1]),
    });
  }

  return stats;
}

function parseNameStatusLine(
  line: string,
  stats: Map<string, Pick<GitChangedFileSummary, 'additions' | 'deletions'>>,
): GitChangedFileSummary[] {
  const parts = line.split('\t');
  const status = parts[0]?.[0];
  if (!status) {
    return [];
  }

  if (status === 'R' && parts.length >= 3) {
    const oldPath = parts[1];
    const newPath = parts[2];
    if (!oldPath || !newPath) {
      return [];
    }
    const stat = stats.get(newPath) ?? { additions: null, deletions: null };
    return [{ status, path: newPath, oldPath, ...stat }];
  }

  const filePath = parts.at(-1);
  if (!filePath) {
    return [];
  }

  const stat = stats.get(filePath) ?? { additions: null, deletions: null };
  return [{ status, path: filePath, oldPath: null, ...stat }];
}

function parseStatCount(value: string | undefined) {
  if (!value || value === '-') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
