import { gitDiff, gitLog, gitShow } from './command';
import { type GitChangedFileSummary, type GitCommitSummary, GitFileStatus } from './types';

type GitChangedFileStats = Pick<GitChangedFileSummary, 'additions' | 'deletions'>;

export function gitFileContent(path: string, ref: string, filePath: string): string | null {
  return gitShow(path, [`${ref}:${filePath}`]);
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

function parseNumstat(output: string) {
  const stats = new Map<string, GitChangedFileStats>();

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
  stats: Map<string, GitChangedFileStats>,
): GitChangedFileSummary[] {
  const parts = line.split('\t');
  const status = parts[0]?.[0];
  if (!status) {
    return [];
  }

  if (status === GitFileStatus.Renamed && parts.length >= 3) {
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
