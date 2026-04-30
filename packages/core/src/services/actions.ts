import { existsSync } from 'node:fs';
import type { TagUpdate } from '../core/context-tags';
import { updateContextTags } from '../core/context-tags';
import { getCurrentBranch } from '../core/hooks';
import {
  type CreateBranchContextResult,
  getBranchDir,
  type ResetBranchContextResult,
  resetBranchContext,
  sanitizeBranchName,
  syncBranch,
  type UpdateSymlinkResult,
} from '../core/sync';
import { getBaseBranch, saveBaseBranch } from '../data/branch-base';
import { Config, configExists, listTemplates } from '../data/config';
import { updateBranchMeta } from '../data/meta';

export type BranchContextActionErrorReason =
  | 'not_initialized'
  | 'no_current_branch'
  | 'missing_context'
  | 'no_templates'
  | 'template_not_found';

export type BranchContextActionError = {
  ok: false;
  reason: BranchContextActionErrorReason;
  message: string;
  branch?: string;
  templates?: string[];
};

export type SyncCurrentBranchOptions = {
  sound?: boolean;
};

export type SyncCurrentBranchResult =
  | {
      ok: true;
      branch: string;
      branchKey: string;
      contextDir: string;
      symlinkPath: string;
      createResult: CreateBranchContextResult;
      symlinkResult: UpdateSymlinkResult;
      baseBranch: string;
      updates: TagUpdate[];
    }
  | BranchContextActionError;

export type CurrentBaseResult =
  | {
      ok: true;
      branch: string;
      contextDir: string;
      baseBranch: string;
    }
  | BranchContextActionError;

export type SetCurrentBaseResult =
  | {
      ok: true;
      branch: string;
      contextDir: string;
      baseBranch: string;
    }
  | BranchContextActionError;

export type ApplyTemplateResult =
  | {
      ok: true;
      branch: string;
      branchKey: string;
      contextDir: string;
      template: string;
      resetResult: ResetBranchContextResult;
      baseBranch: string;
      updates: TagUpdate[];
    }
  | BranchContextActionError;

export type ListAvailableTemplatesResult =
  | {
      ok: true;
      templates: string[];
    }
  | BranchContextActionError;

export function syncCurrentBranch(
  gitRoot: string,
  options: SyncCurrentBranchOptions = {},
): SyncCurrentBranchResult {
  const current = getInitializedCurrentBranch(gitRoot);
  if (!current.ok) {
    return current;
  }

  const result = syncBranch(gitRoot, current.branch, { sound: options.sound });
  const branchKey = sanitizeBranchName(current.branch);
  const contextDir = result.branch_dir;
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);

  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);

  return {
    ok: true,
    branch: result.branch,
    branchKey,
    contextDir,
    symlinkPath: result.symlink_path,
    createResult: result.create_result,
    symlinkResult: result.symlink_result,
    baseBranch,
    updates: updateContextTags(gitRoot, contextDir, branchKey, baseBranch),
  };
}

export function getCurrentBase(gitRoot: string): CurrentBaseResult {
  const current = getExistingCurrentContext(gitRoot);
  if (!current.ok) {
    return current;
  }

  return {
    ok: true,
    branch: current.branch,
    contextDir: current.contextDir,
    baseBranch: getBaseBranch(gitRoot, current.contextDir),
  };
}

export function setCurrentBase(gitRoot: string, baseBranch: string): SetCurrentBaseResult {
  const current = getExistingCurrentContext(gitRoot);
  if (!current.ok) {
    return current;
  }

  saveBaseBranch(current.contextDir, baseBranch);

  return {
    ok: true,
    branch: current.branch,
    contextDir: current.contextDir,
    baseBranch,
  };
}

export function applyTemplateToCurrentBranch(
  gitRoot: string,
  templateName: string,
): ApplyTemplateResult {
  const current = getInitializedCurrentBranch(gitRoot);
  if (!current.ok) {
    return current;
  }

  const templatesResult = listAvailableTemplates(gitRoot);
  if (!templatesResult.ok) {
    return templatesResult;
  }

  if (templatesResult.templates.length === 0) {
    return {
      ok: false,
      reason: 'no_templates',
      message: 'no templates found',
      branch: current.branch,
    };
  }

  if (!templatesResult.templates.includes(templateName)) {
    return {
      ok: false,
      reason: 'template_not_found',
      message: `template '${templateName}' not found`,
      branch: current.branch,
      templates: templatesResult.templates,
    };
  }

  const resetResult = resetBranchContext(gitRoot, current.branch, templateName);
  if (resetResult === 'template_not_found') {
    return {
      ok: false,
      reason: 'template_not_found',
      message: 'template not found',
      branch: current.branch,
      templates: templatesResult.templates,
    };
  }

  const branchKey = sanitizeBranchName(current.branch);
  const contextDir = getBranchDir(gitRoot, current.branch);
  const baseBranch = getBaseBranch(gitRoot, contextDir);

  return {
    ok: true,
    branch: current.branch,
    branchKey,
    contextDir,
    template: templateName,
    resetResult,
    baseBranch,
    updates: updateContextTags(gitRoot, contextDir, branchKey, baseBranch),
  };
}

export function listAvailableTemplates(gitRoot: string): ListAvailableTemplatesResult {
  if (!configExists(gitRoot)) {
    return notInitialized();
  }

  return {
    ok: true,
    templates: listTemplates(gitRoot),
  };
}

type InitializedCurrentBranch =
  | {
      ok: true;
      branch: string;
    }
  | BranchContextActionError;

type ExistingCurrentContext =
  | {
      ok: true;
      branch: string;
      contextDir: string;
    }
  | BranchContextActionError;

function getInitializedCurrentBranch(gitRoot: string): InitializedCurrentBranch {
  if (!configExists(gitRoot)) {
    return notInitialized();
  }

  const branch = getCurrentBranch(gitRoot);
  if (!branch) {
    return {
      ok: false,
      reason: 'no_current_branch',
      message: 'could not determine current branch',
    };
  }

  return {
    ok: true,
    branch,
  };
}

function getExistingCurrentContext(gitRoot: string): ExistingCurrentContext {
  const current = getInitializedCurrentBranch(gitRoot);
  if (!current.ok) {
    return current;
  }

  const contextDir = getBranchDir(gitRoot, current.branch);
  if (!existsSync(contextDir)) {
    return {
      ok: false,
      reason: 'missing_context',
      message: `no context for '${current.branch}'`,
      branch: current.branch,
    };
  }

  return {
    ok: true,
    branch: current.branch,
    contextDir,
  };
}

function notInitialized(): BranchContextActionError {
  return {
    ok: false,
    reason: 'not_initialized',
    message: 'not initialized',
  };
}
