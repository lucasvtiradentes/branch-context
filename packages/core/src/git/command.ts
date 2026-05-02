import { spawnSync } from 'node:child_process';

type GitOutputOptions = {
  maxBuffer?: number;
};

export function gitLog(path: string, args: string[]): string | null {
  return gitOutput(path, ['log', ...args]);
}

export function gitDiff(path: string, args: string[]): string | null {
  return gitOutput(path, ['diff', ...args]);
}

export function gitShow(path: string, args: string[]): string | null {
  return gitOutput(path, ['show', ...args], { maxBuffer: 20 * 1024 * 1024 });
}

export function gitOutput(
  path: string,
  args: string[],
  options: GitOutputOptions = {},
): string | null {
  const result = spawnSync('git', args, {
    cwd: path,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}
