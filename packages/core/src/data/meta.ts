import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ARCHIVED_DIR, META_FILE } from '../constants';
import { GitFileStatus, gitDiff, gitLog, gitRefExists, gitUserName } from '../git';
import { getBranchesDir } from './config';

export const BASE_BRANCH_NOT_FOUND_TEMPLATE = 'Base branch not found: {base_branch}';

export type BranchMeta = {
  branch: string;
  created_at: string;
  author: string | null;
  updated_at: string;
  last_commit: { hash: string; message: string; datetime: string } | null;
  commits: string;
  changed_files: string;
};

function getMetaPath(workspace: string) {
  return join(getBranchesDir(workspace), META_FILE);
}

function getArchivedMetaPath(workspace: string) {
  return join(getBranchesDir(workspace), ARCHIVED_DIR, META_FILE);
}

function loadMeta(path: string): Record<string, BranchMeta> {
  if (!existsSync(path)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, BranchMeta>;
  } catch {
    return {};
  }
}

function saveMeta(path: string, data: Record<string, BranchMeta>) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function getLastCommit(workspace: string) {
  const output = gitLog(workspace, ['-1', '--format=%H|%s|%aI']);
  if (!output) {
    return null;
  }

  const parts = output.trim().split('|', 3);
  if (parts.length !== 3) {
    return null;
  }
  const [hash, message, datetime] = parts as [string, string, string];

  return {
    hash: hash.slice(0, 7),
    message,
    datetime,
  };
}

export function getCommitsSinceBase(
  workspace: string,
  baseBranch: string,
  includeDescription = false,
) {
  if (!gitRefExists(workspace, baseBranch)) {
    return formatMissingBaseBranch(baseBranch);
  }

  if (!includeDescription) {
    return gitLog(workspace, [`${baseBranch}..HEAD`, '--oneline'])?.trim() ?? '';
  }

  const raw = gitLog(workspace, [`${baseBranch}..HEAD`, '--format=%h %s%x1f%b%x1e'])?.trim();
  if (!raw) {
    return '';
  }

  const lines: string[] = [];
  for (const entry of raw.split('\x1e')) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const [subject = '', body = ''] = trimmed.split('\x1f', 2);
    const normalizedBody = body.trim().split(/\s+/).filter(Boolean).join(' ');
    if (normalizedBody) {
      lines.push(`${subject.trim()} - ${normalizedBody}`);
    } else {
      lines.push(subject.trim());
    }
  }

  return lines.join('\n');
}

export function getChangedFiles(workspace: string, baseBranch: string) {
  if (!gitRefExists(workspace, baseBranch)) {
    return formatMissingBaseBranch(baseBranch);
  }

  const statusOutput = gitDiff(workspace, ['--name-status', '-M100', `${baseBranch}...HEAD`]);
  const numstatOutput = gitDiff(workspace, ['--numstat', '-M100', `${baseBranch}...HEAD`]);

  if (!statusOutput) {
    return '';
  }

  const statusLines = statusOutput.trim().split('\n').filter(Boolean);
  const numstatLines = (numstatOutput ?? '').trim().split('\n').filter(Boolean);

  if (statusLines.length === 0) {
    return '';
  }

  const fileStats = new Map<string, [string, string]>();
  for (const line of numstatLines) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const added = parts[0] ?? '0';
      const removed = parts[1] ?? '0';
      const filepath = parts.length === 3 ? parts[2] : parts[3];
      if (filepath) {
        fileStats.set(filepath, [added, removed]);
      }
    }
  }

  const files: Array<{
    status: string;
    filepath: string;
    oldPath: string;
    added: string;
    removed: string;
  }> = [];

  for (const line of statusLines) {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const status = parts[0]?.[0];
      if (!status) {
        continue;
      }
      if (status === GitFileStatus.Renamed && parts.length >= 3) {
        const oldPath = parts[1];
        const newPath = parts[2];
        if (!oldPath || !newPath) {
          continue;
        }
        const [added, removed] = fileStats.get(newPath) ?? ['0', '0'];
        files.push({ status, filepath: newPath, oldPath, added, removed });
      } else {
        const filepath = parts.at(-1) ?? '';
        const [added, removed] = fileStats.get(filepath) ?? ['0', '0'];
        files.push({ status, filepath, oldPath: '', added, removed });
      }
    }
  }

  if (files.length === 0) {
    return '';
  }

  const displayPath = (file: (typeof files)[number]) =>
    file.status === GitFileStatus.Renamed && file.oldPath
      ? `${file.filepath}  <-  ${file.oldPath}`
      : file.filepath;

  const maxDisplayLength = Math.max(...files.map((file) => displayPath(file).length));
  return files
    .map((file) => {
      const paddedDisplay = displayPath(file).padEnd(maxDisplayLength);
      return `${file.status}  ${paddedDisplay}  (+${file.added} -${file.removed})`;
    })
    .join('\n');
}

function formatMissingBaseBranch(baseBranch: string) {
  return BASE_BRANCH_NOT_FOUND_TEMPLATE.replace('{base_branch}', baseBranch);
}

export function loadBranchMeta(workspace: string) {
  return loadMeta(getMetaPath(workspace));
}

export function loadArchivedMeta(workspace: string) {
  return loadMeta(getArchivedMetaPath(workspace));
}

export function getBranchMeta(workspace: string, branchKey: string) {
  return loadBranchMeta(workspace)[branchKey] ?? null;
}

export function createBranchMeta(workspace: string, branchKey: string, branch: string) {
  const meta = loadBranchMeta(workspace);
  const now = new Date().toISOString();

  if (!(branchKey in meta)) {
    meta[branchKey] = {
      branch,
      created_at: now,
      author: gitUserName(workspace),
      updated_at: now,
      last_commit: null,
      commits: '',
      changed_files: '',
    };
    saveMeta(getMetaPath(workspace), meta);
  }
}

export function updateBranchMeta(
  workspace: string,
  branchKey: string,
  baseBranch: string,
  includeDescription = false,
) {
  const meta = loadBranchMeta(workspace);
  const branchMeta = meta[branchKey];
  if (!branchMeta) {
    return;
  }

  branchMeta.updated_at = new Date().toISOString();
  branchMeta.last_commit = getLastCommit(workspace);
  branchMeta.commits = getCommitsSinceBase(workspace, baseBranch, includeDescription);
  branchMeta.changed_files = getChangedFiles(workspace, baseBranch);

  saveMeta(getMetaPath(workspace), meta);
}

export function archiveBranchMeta(workspace: string, branchKey: string) {
  moveMetaEntry(branchKey, getMetaPath(workspace), getArchivedMetaPath(workspace));
}

export function unarchiveBranchMeta(workspace: string, branchKey: string) {
  moveMetaEntry(branchKey, getArchivedMetaPath(workspace), getMetaPath(workspace));
}

export function deleteBranchMeta(workspace: string, branchKey: string) {
  deleteMetaEntry(getMetaPath(workspace), branchKey);
}

export function deleteArchivedBranchMeta(workspace: string, branchKey: string) {
  deleteMetaEntry(getArchivedMetaPath(workspace), branchKey);
}

function moveMetaEntry(branchKey: string, fromPath: string, toPath: string) {
  const meta = loadMeta(fromPath);
  const branchData = meta[branchKey];
  if (!branchData) {
    return;
  }

  delete meta[branchKey];
  saveMeta(fromPath, meta);

  const targetMeta = loadMeta(toPath);
  targetMeta[branchKey] = branchData;
  saveMeta(toPath, targetMeta);
}

function deleteMetaEntry(path: string, branchKey: string) {
  const meta = loadMeta(path);
  if (branchKey in meta) {
    delete meta[branchKey];
    saveMeta(path, meta);
  }
}
