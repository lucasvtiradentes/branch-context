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
import { getBranchDir, getBranchRelPath, listArchivedBranches } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { configExists, getTemplatesDir, listTemplates } from '../data/config';

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
  const archivedCount = initialized ? listArchivedBranches(gitRoot).length : 0;
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
    archivedCount,
  };
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
