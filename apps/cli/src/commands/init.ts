import {
  BranchContextActionErrorReason,
  CLI_NAME,
  Config,
  configExists,
  DEFAULT_SYMLINK,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  HookInstallResult,
  type InitProjectResult,
  initProject,
  UpdateSymlinkResult,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';
import { promptText, promptYesNo } from '../ui/prompt';

const hookInstallMessages = {
  [HookInstallResult.Installed]: (hookName: string) => `Hook installed: ${hookName}`,
  [HookInstallResult.Updated]: (hookName: string) => `Hook updated: ${hookName}`,
  [HookInstallResult.Appended]: (hookName: string) => `Hook appended: ${hookName}`,
  [HookInstallResult.HookExists]: (hookName: string) =>
    `warning: ${hookName} hook exists but not managed by ${CLI_NAME}`,
  [HookInstallResult.AlreadyInstalled]: () => null,
} as const satisfies Record<HookInstallResult, (hookName: string) => string | null>;

export function registerInitCommand(program: Program) {
  program
    .command('init', 'Initialize and install hook')
    .option('--branches-parent-folder <path>', 'Parent folder where branches/ will be created')
    .option('--templates-folder <path>', 'Templates folder path')
    .action(() => cmdInit([]));
}

export async function runInitCommand(args: string[]) {
  return await cmdInit(args);
}

async function cmdInit(args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const initOptions = await parseInitOptions(args);
  if (!initOptions.ok) {
    console.log(`error: ${initOptions.message}`);
    return 1;
  }

  const result = await initProject(gitRoot, promptYesNo, initOptions.options);
  if (!result.ok) {
    console.log(`error: ${result.message}`);
    return 1;
  }

  printInitResult(result);

  if (result.syncResult.ok) {
    if (result.syncResult.symlinkResult === UpdateSymlinkResult.ErrorNotSymlink) {
      console.log(`error: ${DEFAULT_SYMLINK} exists but is not a symlink`);
      return 1;
    }

    console.log(`Synced: ${result.syncResult.branch}`);
    return 0;
  }

  if (result.syncResult.reason === BranchContextActionErrorReason.NoCurrentBranch) {
    console.log('warning: no current branch to sync');
    return 0;
  }

  console.log(`warning: ${result.syncResult.message}`);
  return 0;
}

async function parseInitOptions(
  args: string[],
): Promise<
  { ok: true; options: Parameters<typeof initProject>[2] } | { ok: false; message: string }
> {
  const branchesParentFolder = argValue(args, '--branches-parent-folder');
  const templatesFolder = argValue(args, '--templates-folder');
  const initOptions: Parameters<typeof initProject>[2] = {};
  const gitRoot = requireGitRoot();
  const alreadyInitialized = gitRoot ? configExists(gitRoot) : false;

  if (branchesParentFolder) {
    initOptions.branchesParentFolder = normalizeFolderArg(branchesParentFolder);
  } else if (shouldPromptInitFolders(args, alreadyInitialized)) {
    initOptions.branchesParentFolder = normalizeFolderArg(
      await promptText('Branches parent folder', getBranchesParentFolderDefault(gitRoot)),
    );
  }

  if (templatesFolder) {
    initOptions.templatesFolder = normalizeFolderArg(templatesFolder);
  } else if (shouldPromptInitFolders(args, alreadyInitialized)) {
    initOptions.templatesFolder = normalizeFolderArg(
      await promptText('Templates folder', getTemplatesFolderDefault(gitRoot)),
    );
  }

  return { ok: true, options: initOptions };
}

function shouldPromptInitFolders(args: string[], alreadyInitialized: boolean) {
  return !alreadyInitialized && args.length === 1 && process.stdin.isTTY;
}

function getBranchesParentFolderDefault(gitRoot: string | null) {
  if (!gitRoot || !configExists(gitRoot)) {
    return '.bctx';
  }

  const branchesFolder = Config.load(gitRoot).branchesFolder;
  return branchesFolder.endsWith('/branches')
    ? branchesFolder.slice(0, -'/branches'.length) || '.'
    : branchesFolder;
}

function getTemplatesFolderDefault(gitRoot: string | null) {
  return gitRoot && configExists(gitRoot)
    ? Config.load(gitRoot).templatesFolder
    : '.bctx/templates';
}

function normalizeFolderArg(path: string) {
  return path.trim();
}

function argValue(args: string[], name: string) {
  const equalPrefix = `${name}=`;
  const equalValue = args.find((arg) => arg.startsWith(equalPrefix));
  if (equalValue) {
    return equalValue.slice(equalPrefix.length).trim() || null;
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value.trim() : null;
}

function printInitResult(result: Extract<InitProjectResult, { ok: true }>) {
  if (!result.alreadyInitialized) {
    console.log(`Initialized: ${result.configDir}`);
    console.log(`  config:    ${result.configPath}`);
    console.log(`  templates: ${result.templatesDir}/`);
    console.log(`  branches:  ${result.branchesDir}/ (gitignored)`);
  }

  printHookInstallResult(result.checkoutHook, HOOK_POST_CHECKOUT);
  if (result.checkoutHook === HookInstallResult.AlreadyInstalled && result.alreadyInitialized) {
    console.log('Already initialized');
  }

  printHookInstallResult(result.commitHook, HOOK_POST_COMMIT);
}

function printHookInstallResult(result: HookInstallResult, hookName: string) {
  const message = hookInstallMessages[result](hookName);
  if (message) {
    console.log(message);
  }
}
