import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, DEFAULT_SYMLINK, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT } from '../constants';
import type { TagUpdate } from '../core/context-tags';
import { updateContextTags } from '../core/context-tags';
import { getCurrentBranch, installHook } from '../core/hooks';
import {
  archiveBranch,
  type CreateBranchContextResult,
  copyInitTemplates,
  createBranchContext,
  deleteBranchContext,
  getBranchDir,
  type ResetBranchContextResult,
  resetBranchContext,
  sanitizeBranchName,
  type UpdateSymlinkResult,
  unarchiveBranch,
  updateSymlink,
} from '../core/sync';
import { getBaseBranch, saveBaseBranch } from '../data/branch-base';
import {
  Config,
  configExists,
  getBranchesDir,
  getConfigDir,
  getTemplatesDir,
  listTemplates,
} from '../data/config';
import { updateBranchMeta } from '../data/meta';
import type { PromptYesNo } from '../utils/prompt';

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
  playSound?: (soundFile: string | null) => void;
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

export type ContextActionResult =
  | {
      ok: true;
      branchKey: string;
    }
  | BranchContextActionError;

export type InitProjectResult =
  | {
      ok: true;
      configDir: string;
      configPath: string;
      templatesDir: string;
      branchesDir: string;
      alreadyInitialized: boolean;
      checkoutHook: Awaited<ReturnType<typeof installHook>>;
      commitHook: Awaited<ReturnType<typeof installHook>>;
      syncResult: SyncCurrentBranchResult | null;
    }
  | BranchContextActionError;

export async function initProject(
  gitRoot: string,
  ask: PromptYesNo = yes,
): Promise<InitProjectResult> {
  const configDir = getConfigDir(gitRoot);
  const templatesDir = getTemplatesDir(gitRoot);
  const branchesDir = getBranchesDir(gitRoot);
  const alreadyInitialized = configExists(gitRoot);

  if (!alreadyInitialized) {
    mkdirSync(configDir, { recursive: true });
    mkdirSync(branchesDir, { recursive: true });
    new Config().save(gitRoot);
    copyInitTemplates(templatesDir);
  }

  const checkoutHook = await installHook(gitRoot, HOOK_POST_CHECKOUT, ask);
  const commitHook = await installHook(gitRoot, HOOK_POST_COMMIT, ask);

  addToGitignore(gitRoot, DEFAULT_SYMLINK);
  addToGitignore(gitRoot, '.bctx/branches/');

  return {
    ok: true,
    configDir,
    configPath: `${configDir}/${CONFIG_FILE}`,
    templatesDir,
    branchesDir,
    alreadyInitialized,
    checkoutHook,
    commitHook,
    syncResult: syncCurrentBranch(gitRoot, { sound: false }),
  };
}

export function syncCurrentBranch(
  gitRoot: string,
  options: SyncCurrentBranchOptions = {},
): SyncCurrentBranchResult {
  const current = getInitializedCurrentBranch(gitRoot);
  if (!current.ok) {
    return current;
  }

  const branchKey = sanitizeBranchName(current.branch);
  const createResult = createBranchContext(gitRoot, current.branch);
  const symlinkResult = updateSymlink(gitRoot, current.branch);
  const contextDir = getBranchDir(gitRoot, current.branch);
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);

  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);
  if (options.sound) {
    options.playSound?.(config.soundFile);
  }

  return {
    ok: true,
    branch: current.branch,
    branchKey,
    contextDir,
    symlinkPath: DEFAULT_SYMLINK,
    createResult,
    symlinkResult,
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

export function archiveContextByKey(gitRoot: string, branchKey: string): ContextActionResult {
  if (!configExists(gitRoot)) {
    return notInitialized();
  }

  if (!archiveBranch(gitRoot, branchKey)) {
    return missingContext(branchKey);
  }

  return {
    ok: true,
    branchKey,
  };
}

export function restoreContextByKey(gitRoot: string, branchKey: string): ContextActionResult {
  if (!configExists(gitRoot)) {
    return notInitialized();
  }

  if (!unarchiveBranch(gitRoot, branchKey)) {
    return missingContext(branchKey);
  }

  return {
    ok: true,
    branchKey,
  };
}

export function deleteContextByKey(
  gitRoot: string,
  branchKey: string,
  archived = false,
): ContextActionResult {
  if (!configExists(gitRoot)) {
    return notInitialized();
  }

  if (!deleteBranchContext(gitRoot, branchKey, archived)) {
    return missingContext(branchKey);
  }

  return {
    ok: true,
    branchKey,
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

function addToGitignore(gitRoot: string, value: string) {
  const gitignoreFile = join(gitRoot, '.gitignore');
  const existing = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, 'utf8') : '';

  if (!existing.split(/\r?\n/).includes(value)) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(gitignoreFile, `${existing}${prefix}${value}\n`);
  }
}

async function yes(): Promise<boolean> {
  return true;
}

function notInitialized(): BranchContextActionError {
  return {
    ok: false,
    reason: 'not_initialized',
    message: 'not initialized',
  };
}

function missingContext(branchKey: string): BranchContextActionError {
  return {
    ok: false,
    reason: 'missing_context',
    message: `no context for '${branchKey}'`,
    branch: branchKey,
  };
}
