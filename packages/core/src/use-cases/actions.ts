import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_SYMLINK, HookType } from '../constants';
import type { TagUpdate } from '../core/context-tags';
import { updateContextTags } from '../core/context-tags';
import { getCurrentBranch, installHook, type PromptYesNo } from '../core/hooks';
import {
  archiveBranch,
  type CreateBranchContextResult,
  copyInitTemplates,
  createBranchContext,
  deleteBranchContext,
  getBranchDir,
  ResetBranchContextResult,
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
  ensureConfig,
  getActiveSharedPath,
  getBranchesDir,
  getConfigDir,
  getSharedConfigPath,
  getTemplatesDir,
  getWorkspaceSharedPath,
  listTemplates,
} from '../data/config';
import { updateBranchMeta } from '../data/meta';
import { gitInfoExcludeAdd, gitOriginUrl, gitRefExists, normalizeGitRemoteUrl } from '../git';

export enum BranchContextActionErrorReason {
  NotInitialized = 'not_initialized',
  NoCurrentBranch = 'no_current_branch',
  MissingContext = 'missing_context',
  BaseBranchNotFound = 'base_branch_not_found',
  NoTemplates = 'no_templates',
  TemplateNotFound = 'template_not_found',
  InvalidPath = 'invalid_path',
}

export type BranchContextActionError = {
  ok: false;
  reason: BranchContextActionErrorReason;
  message: string;
  branch?: string;
  baseBranch?: string;
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
      mode: 'local' | 'shared';
      sharedPath: string | null;
      configDir: string;
      configPath: string;
      templatesDir: string;
      branchesDir: string;
      alreadyInitialized: boolean;
      checkoutHook: Awaited<ReturnType<typeof installHook>>;
      commitHook: Awaited<ReturnType<typeof installHook>>;
      syncResult: SyncCurrentBranchResult;
    }
  | BranchContextActionError;

export type InitProjectOptions = {
  hookCommandName?: string | null;
  sharedPath?: string | null;
};

export async function initProject(
  gitRoot: string,
  ask: PromptYesNo = yes,
  options: InitProjectOptions = {},
): Promise<InitProjectResult> {
  const sharedPath = getActiveSharedPath(options.sharedPath);
  const sharedInitResult = sharedPath ? initSharedBctx(gitRoot, sharedPath) : null;
  if (sharedInitResult && !sharedInitResult.ok) {
    return sharedInitResult;
  }

  const alreadyInitialized = configExists(gitRoot);
  ensureConfig(gitRoot);

  const mode = getWorkspaceSharedPath(gitRoot) ? 'shared' : 'local';
  const configDir = getDisplayPath(getConfigDir(gitRoot));
  const templatesDir = getDisplayPath(getTemplatesDir(gitRoot));
  const branchesDir = getDisplayPath(getBranchesDir(gitRoot));

  mkdirSync(branchesDir, { recursive: true });
  ensureInitTemplates(gitRoot, templatesDir, alreadyInitialized);

  const checkoutHook = await installHook(gitRoot, HookType.PostCheckout, ask, {
    commandName: options.hookCommandName,
  });
  const commitHook = await installHook(gitRoot, HookType.PostCommit, ask, {
    commandName: options.hookCommandName,
  });

  addInitLocalExcludeEntries(gitRoot);

  return {
    ok: true,
    mode,
    sharedPath: getWorkspaceSharedPath(gitRoot),
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

function getDisplayPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function initSharedBctx(
  gitRoot: string,
  sharedPath: string,
): { ok: true } | BranchContextActionError {
  const remote = gitOriginUrl(gitRoot);
  const ref = remote ? normalizeGitRemoteUrl(remote) : null;
  if (!ref) {
    return { ok: true };
  }

  const target = join(sharedPath, 'repos', ref.owner, ref.repo, CONFIG_DIR);
  mkdirSync(target, { recursive: true });
  ensureSharedConfig(sharedPath);
  const linkResult = ensureSharedLink(gitRoot, target);
  if (!linkResult.ok) {
    return linkResult;
  }
  return { ok: true };
}

function ensureSharedConfig(sharedPath: string) {
  const configPath = getSharedConfigPath(sharedPath);
  if (configPath && !existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      `${JSON.stringify({ default_base_branch: 'origin/main', sound: true, commit_description: false }, null, 2)}\n`,
    );
  }
}

function ensureSharedLink(
  gitRoot: string,
  target: string,
): { ok: true } | BranchContextActionError {
  const link = getConfigDir(gitRoot);
  if (existsSync(link) || isBrokenSymlink(link)) {
    if (!isSymlink(link)) {
      return invalidPath(`${CONFIG_DIR} exists but is not a symlink`);
    }
    rmSync(link, { force: true });
  }

  symlinkSync(target, link, 'dir');
  return { ok: true };
}

function ensureInitTemplates(_gitRoot: string, templatesDir: string, _alreadyInitialized: boolean) {
  mkdirSync(templatesDir, { recursive: true });
  if (listTemplates(_gitRoot).length === 0) {
    copyInitTemplates(templatesDir);
  }
}

function isSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function isBrokenSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink() && !existsSync(path);
  } catch {
    return false;
  }
}

export function addToGitignore(gitRoot: string, value: string) {
  const gitignoreFile = join(gitRoot, '.gitignore');
  const existing = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, 'utf8') : '';

  if (!existing.split(/\r?\n/).includes(value)) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(gitignoreFile, `${existing}${prefix}${value}\n`);
  }
}

function removeFromGitignore(gitRoot: string, shouldRemove: (value: string) => boolean) {
  const gitignoreFile = join(gitRoot, '.gitignore');
  if (!existsSync(gitignoreFile)) {
    return;
  }

  const existing = readFileSync(gitignoreFile, 'utf8');
  const nextLines = existing.split(/\r?\n/).filter((line) => !shouldRemove(line));
  const next = nextLines.join('\n');
  writeFileSync(gitignoreFile, next.endsWith('\n') ? next : `${next}\n`);
}

function addInitLocalExcludeEntries(gitRoot: string) {
  removeFromGitignore(gitRoot, isBctxGitignoreModeEntry);
  gitInfoExcludeAdd(gitRoot, DEFAULT_SYMLINK);
  gitInfoExcludeAdd(gitRoot, CONFIG_DIR);
}

function isBctxGitignoreModeEntry(value: string) {
  return (
    value === DEFAULT_SYMLINK ||
    value === CONFIG_DIR ||
    value === `${CONFIG_DIR}/*` ||
    value === `${CONFIG_DIR}/` ||
    value.startsWith(`!${CONFIG_DIR}/`)
  );
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
  const baseBranchError = validateBaseBranch(gitRoot, current.branch, baseBranch);
  if (baseBranchError) {
    return baseBranchError;
  }
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
      reason: BranchContextActionErrorReason.NoTemplates,
      message: 'no templates found',
      branch: current.branch,
    };
  }

  if (!templatesResult.templates.includes(templateName)) {
    return {
      ok: false,
      reason: BranchContextActionErrorReason.TemplateNotFound,
      message: `template '${templateName}' not found`,
      branch: current.branch,
      templates: templatesResult.templates,
    };
  }

  const resetResult = resetBranchContext(gitRoot, current.branch, templateName);
  if (resetResult === ResetBranchContextResult.TemplateNotFound) {
    return {
      ok: false,
      reason: BranchContextActionErrorReason.TemplateNotFound,
      message: 'template not found',
      branch: current.branch,
      templates: templatesResult.templates,
    };
  }

  const branchKey = sanitizeBranchName(current.branch);
  const contextDir = getBranchDir(gitRoot, current.branch);
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const baseBranchError = validateBaseBranch(gitRoot, current.branch, baseBranch);
  if (baseBranchError) {
    return baseBranchError;
  }

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
      reason: BranchContextActionErrorReason.NoCurrentBranch,
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
      reason: BranchContextActionErrorReason.MissingContext,
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

async function yes(): Promise<boolean> {
  return true;
}

function validateBaseBranch(
  gitRoot: string,
  branch: string,
  baseBranch: string,
): BranchContextActionError | null {
  if (gitRefExists(gitRoot, baseBranch)) {
    return null;
  }

  return {
    ok: false,
    reason: BranchContextActionErrorReason.BaseBranchNotFound,
    message: `base branch not found: ${baseBranch}`,
    branch,
    baseBranch,
  };
}

function notInitialized(): BranchContextActionError {
  return {
    ok: false,
    reason: BranchContextActionErrorReason.NotInitialized,
    message: 'not initialized',
  };
}

function missingContext(branchKey: string): BranchContextActionError {
  return {
    ok: false,
    reason: BranchContextActionErrorReason.MissingContext,
    message: `no context for '${branchKey}'`,
    branch: branchKey,
  };
}

function invalidPath(message: string): BranchContextActionError {
  return {
    ok: false,
    reason: BranchContextActionErrorReason.InvalidPath,
    message,
  };
}
