import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, sep as pathSeparator, relative, resolve } from 'node:path';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_SYMLINK, HookType, TEMPLATES_DIR } from '../constants';
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
  copyInitConfig,
  getBranchesDir,
  getConfigDir,
  getLocalTemplatesDir,
  getTemplatesDir,
  listTemplates,
} from '../data/config';
import { updateBranchMeta } from '../data/meta';
import { gitRefExists } from '../git';

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
  branchesParentFolder?: string | null;
  hookCommandName?: string | null;
  templatesFolder?: string | null;
};

export async function initProject(
  gitRoot: string,
  ask: PromptYesNo = yes,
  options: InitProjectOptions = {},
): Promise<InitProjectResult> {
  const configDir = getConfigDir(gitRoot);
  const alreadyInitialized = configExists(gitRoot);

  if (!alreadyInitialized) {
    mkdirSync(configDir, { recursive: true });
    copyInitConfig(gitRoot);
  }

  const configResult = configureInitFolders(gitRoot, options);
  if (!configResult.ok) {
    return configResult;
  }
  const templatesDir = getTemplatesDir(gitRoot);
  const branchesDir = getBranchesDir(gitRoot);

  mkdirSync(branchesDir, { recursive: true });
  ensureInitTemplates(gitRoot, templatesDir, alreadyInitialized);

  const checkoutHook = await installHook(gitRoot, HookType.PostCheckout, ask, {
    commandName: options.hookCommandName,
  });
  const commitHook = await installHook(gitRoot, HookType.PostCommit, ask, {
    commandName: options.hookCommandName,
  });

  addInitGitignoreEntries(gitRoot, branchesDir, templatesDir);

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

function configureInitFolders(
  gitRoot: string,
  options: InitProjectOptions,
): { ok: true; config: Config } | BranchContextActionError {
  const config = Config.load(gitRoot);
  let changed = false;

  if (options.branchesParentFolder !== undefined && options.branchesParentFolder !== null) {
    const branchesFolder = normalizeBranchesFolder(options.branchesParentFolder);
    const parentFolder = resolve(resolveConfiguredFolder(gitRoot, branchesFolder), '..');
    if (!existsSync(parentFolder)) {
      return invalidPath(`branches parent folder does not exist: ${parentFolder}`);
    }
    config.branchesFolder = branchesFolder;
    changed = true;
  }

  if (options.templatesFolder !== undefined && options.templatesFolder !== null) {
    const templatesFolder = normalizeConfiguredFolder(options.templatesFolder);
    const resolvedTemplatesFolder = resolveConfiguredFolder(gitRoot, templatesFolder);
    if (
      templatesFolder !== `${CONFIG_DIR}/${TEMPLATES_DIR}` &&
      !existsSync(resolvedTemplatesFolder)
    ) {
      return invalidPath(`templates folder does not exist: ${resolvedTemplatesFolder}`);
    }
    config.templatesFolder = templatesFolder;
    changed = true;
  }

  if (changed) {
    config.save(gitRoot);
  }
  return { ok: true, config };
}

function ensureInitTemplates(gitRoot: string, templatesDir: string, alreadyInitialized: boolean) {
  if (templatesDir === getLocalTemplatesDir(gitRoot) && !alreadyInitialized) {
    copyInitTemplates(templatesDir);
    return;
  }

  mkdirSync(templatesDir, { recursive: true });
  if (listTemplates(gitRoot).length === 0) {
    copyInitTemplates(templatesDir);
  }
}

function normalizeConfiguredFolder(path: string) {
  return normalizeConfiguredPathValue(path.trim());
}

function normalizeBranchesFolder(path: string) {
  const parentFolder = normalizeConfiguredFolder(path);
  return appendConfiguredPathSegment(parentFolder, 'branches');
}

function resolveConfiguredFolder(gitRoot: string, path: string) {
  return isAbsolute(path) ? path : resolve(gitRoot, path);
}

function appendConfiguredPathSegment(path: string, segment: string) {
  if (isAbsolute(path)) {
    return join(path, segment);
  }

  const normalized = normalizeConfiguredPathValue(path).replace(/[\\/]+$/, '');
  return normalized && normalized !== '.' ? `${normalized}/${segment}` : segment;
}

function normalizeConfiguredPathValue(path: string) {
  return isAbsolute(path) ? path : path.replaceAll('\\', '/');
}

export function addToGitignore(gitRoot: string, value: string) {
  const gitignoreFile = join(gitRoot, '.gitignore');
  const existing = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, 'utf8') : '';

  if (!existing.split(/\r?\n/).includes(value)) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(gitignoreFile, `${existing}${prefix}${value}\n`);
  }
}

function addInitGitignoreEntries(gitRoot: string, branchesDir: string, templatesDir: string) {
  addToGitignore(gitRoot, DEFAULT_SYMLINK);
  addToGitignore(gitRoot, `${CONFIG_DIR}/*`);
  addRepoFolderExceptionToGitignore(gitRoot, getLocalTemplatesDir(gitRoot));
  addRepoFolderExceptionToGitignore(gitRoot, templatesDir);

  const branchesRelPath = getRepoRelativePath(gitRoot, branchesDir);
  if (branchesRelPath && !branchesRelPath.startsWith(`${CONFIG_DIR}/`)) {
    addToGitignore(gitRoot, `${branchesRelPath}/`);
  }
}

function addRepoFolderExceptionToGitignore(gitRoot: string, folder: string) {
  const relPath = getRepoRelativePath(gitRoot, folder);
  if (!relPath?.startsWith(`${CONFIG_DIR}/`)) {
    return;
  }

  addToGitignore(gitRoot, `!${relPath}/`);
  addToGitignore(gitRoot, `!${relPath}/**`);
}

function getRepoRelativePath(gitRoot: string, path: string) {
  const relPath = relative(getComparablePath(gitRoot), getComparablePath(path));
  if (
    !relPath ||
    relPath === '..' ||
    relPath.startsWith(`..${pathSeparator}`) ||
    isAbsolute(relPath)
  ) {
    return null;
  }

  return relPath.replaceAll(pathSeparator, '/');
}

function getComparablePath(path: string) {
  return existsSync(path) ? realpathSync(path) : resolve(path);
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
