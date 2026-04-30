import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { type BranchInfo, collectBranchInfo } from '../commands/_branches';
import {
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
} from '../constants';
import { getCurrentBranch, isHookInstalled } from '../core/hooks';
import { getArchivedDir, getBranchDir, getBranchRelPath, listArchivedBranches } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { configExists, getBranchesDir, getTemplatesDir, listTemplates } from '../data/config';
import { loadArchivedMeta, loadBranchMeta } from '../data/meta';

export type BranchContextStatusIssue = {
  level: 'error' | 'warning';
  message: string;
};

export type BranchContextSymlinkStatus = {
  path: string;
  target: string | null;
  state: 'valid' | 'missing' | 'broken' | 'not_symlink';
};

export type BranchContextHooksStatus = {
  checkout: boolean;
  commit: boolean;
};

export type BranchContextContextSummary = {
  branch: string;
  branchKey: string;
  contextDir: string;
  updatedAt: string | null;
  current: boolean;
  local: boolean;
  remote: boolean;
};

export type BranchContextArchivedContextSummary = {
  branch: string;
  branchKey: string;
  contextDir: string;
  updatedAt: string | null;
};

export type BranchContextStatus = {
  gitRoot: string;
  initialized: boolean;
  currentBranch: string | null;
  currentContextDir: string | null;
  currentContextRelPath: string | null;
  baseBranch: string | null;
  templates: string[];
  templatesDirExists: boolean;
  defaultTemplateExists: boolean;
  hooks: BranchContextHooksStatus;
  symlink: BranchContextSymlinkStatus;
  issues: BranchContextStatusIssue[];
  contexts: Map<string, BranchInfo>;
  recentContexts: BranchContextContextSummary[];
  archivedContexts: BranchContextArchivedContextSummary[];
  archivedCount: number;
};

export function getStatus(gitRoot: string): BranchContextStatus {
  const initialized = configExists(gitRoot);
  const currentBranch = getCurrentBranch(gitRoot);
  const currentContextDir = currentBranch ? getBranchDir(gitRoot, currentBranch) : null;
  const currentContextRelPath = currentBranch ? getBranchRelPath(currentBranch) : null;
  const templates = initialized ? listTemplates(gitRoot) : [];
  const templatesDirExists = initialized ? existsSync(getTemplatesDir(gitRoot)) : false;
  const defaultTemplateExists = templates.includes(DEFAULT_TEMPLATE);
  const hooks = {
    checkout: initialized ? isHookInstalled(gitRoot, HOOK_POST_CHECKOUT) : false,
    commit: initialized ? isHookInstalled(gitRoot, HOOK_POST_COMMIT) : false,
  };
  const symlink = getSymlinkStatus(gitRoot);
  const contexts = initialized ? collectBranchInfo(gitRoot) : new Map<string, BranchInfo>();
  const recentContexts = initialized ? getContextSummaries(gitRoot, currentBranch, contexts) : [];
  const archivedContexts = initialized ? getArchivedContextSummaries(gitRoot) : [];
  const archivedCount = archivedContexts.length;
  const issues: BranchContextStatusIssue[] = [];

  if (!initialized) {
    issues.push({ level: 'error', message: 'not initialized' });
  } else {
    if (!hooks.checkout) {
      issues.push({ level: 'error', message: `${HOOK_POST_CHECKOUT} hook not installed` });
    }

    if (!hooks.commit) {
      issues.push({ level: 'error', message: `${HOOK_POST_COMMIT} hook not installed` });
    }

    if (!templatesDirExists) {
      issues.push({ level: 'error', message: 'templates/ missing' });
    }

    if (!defaultTemplateExists) {
      issues.push({ level: 'error', message: `${DEFAULT_TEMPLATE} template missing` });
    }

    if (symlink.state === 'broken') {
      issues.push({ level: 'error', message: 'symlink points to non-existent target' });
    } else if (symlink.state === 'not_symlink') {
      issues.push({ level: 'error', message: 'symlink path exists but is not a symlink' });
    } else if (symlink.state === 'missing') {
      issues.push({ level: 'warning', message: 'symlink not set' });
    }

    const orphanCount = Array.from(contexts.entries()).filter(
      ([, info]) => info.context && !info.local,
    ).length;
    if (orphanCount > 0) {
      issues.push({ level: 'warning', message: `${orphanCount} orphan contexts` });
    }
  }

  return {
    gitRoot,
    initialized,
    currentBranch,
    currentContextDir,
    currentContextRelPath,
    baseBranch: currentContextDir ? getBaseBranch(gitRoot, currentContextDir) : null,
    templates,
    templatesDirExists,
    defaultTemplateExists,
    hooks,
    symlink,
    issues,
    contexts,
    recentContexts,
    archivedContexts,
    archivedCount,
  };
}

function getContextSummaries(
  gitRoot: string,
  currentBranch: string | null,
  contexts: Map<string, BranchInfo>,
): BranchContextContextSummary[] {
  const meta = loadBranchMeta(gitRoot);

  return Array.from(contexts.entries())
    .filter(([, info]) => info.context)
    .map(([branch, info]) => {
      const branchMeta = meta[info.sanitized];
      return {
        branch,
        branchKey: info.sanitized,
        contextDir: join(getBranchesDir(gitRoot), info.sanitized),
        updatedAt: branchMeta?.updated_at ?? null,
        current: branch === currentBranch,
        local: info.local,
        remote: info.remote,
      };
    })
    .sort(compareContexts);
}

function getArchivedContextSummaries(gitRoot: string): BranchContextArchivedContextSummary[] {
  const archivedMeta = loadArchivedMeta(gitRoot);
  const archivedDir = getArchivedDir(gitRoot);

  return listArchivedBranches(gitRoot)
    .map((branchKey) => {
      const meta = archivedMeta[branchKey];
      return {
        branch: meta?.branch ?? branchKey,
        branchKey,
        contextDir: join(archivedDir, branchKey),
        updatedAt: meta?.updated_at ?? null,
      };
    })
    .sort(compareArchivedContexts);
}

function compareContexts(
  left: BranchContextContextSummary,
  right: BranchContextContextSummary,
): number {
  return (
    compareUpdatedAt(left.updatedAt, right.updatedAt) || left.branch.localeCompare(right.branch)
  );
}

function compareArchivedContexts(
  left: BranchContextArchivedContextSummary,
  right: BranchContextArchivedContextSummary,
): number {
  return (
    compareUpdatedAt(left.updatedAt, right.updatedAt) || left.branch.localeCompare(right.branch)
  );
}

function compareUpdatedAt(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return right.localeCompare(left);
}

function getSymlinkStatus(gitRoot: string): BranchContextSymlinkStatus {
  const path = join(gitRoot, DEFAULT_SYMLINK);

  if (isSymlink(path)) {
    const target = readlinkSync(path);
    return {
      path,
      target,
      state: existsSync(join(gitRoot, target)) ? 'valid' : 'broken',
    };
  }

  if (existsSync(path)) {
    return {
      path,
      target: null,
      state: 'not_symlink',
    };
  }

  return {
    path,
    target: null,
    state: 'missing',
  };
}

function isSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
