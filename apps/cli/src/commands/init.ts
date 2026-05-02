import { mkdirSync } from 'node:fs';
import {
  addToGitignore,
  BRANCHES_DIR,
  CLI_NAME,
  CONFIG_DIR,
  CONFIG_FILE,
  configExists,
  copyInitConfig,
  copyInitTemplates,
  DEFAULT_SYMLINK,
  getBranchesDir,
  getConfigDir,
  getCurrentBranch,
  getTemplatesDir,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  HookInstallResult,
  HookType,
  installHook,
  syncBranch,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';
import { promptYesNo } from '../ui/prompt';

const hookInstallMessages = {
  [HookInstallResult.Installed]: (hookName: string) => `Hook installed: ${hookName}`,
  [HookInstallResult.Updated]: (hookName: string) => `Hook updated: ${hookName}`,
  [HookInstallResult.Appended]: (hookName: string) => `Hook appended: ${hookName}`,
  [HookInstallResult.HookExists]: (hookName: string) =>
    `warning: ${hookName} hook exists but not managed by ${CLI_NAME}`,
  [HookInstallResult.AlreadyInstalled]: () => null,
} as const satisfies Record<HookInstallResult, (hookName: string) => string | null>;

export function registerInitCommand(program: Program) {
  program.command('init', 'Initialize and install hook').action(() => cmdInit([]));
}

async function cmdInit(_args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const configDir = getConfigDir(gitRoot);
  const templatesDir = getTemplatesDir(gitRoot);
  const branchesDir = getBranchesDir(gitRoot);
  const alreadyInitialized = configExists(gitRoot);

  if (!alreadyInitialized) {
    mkdirSync(configDir, { recursive: true });
    mkdirSync(branchesDir, { recursive: true });
    copyInitConfig(gitRoot);
    copyInitTemplates(templatesDir);

    console.log(`Initialized: ${configDir}`);
    console.log(`  config:    ${configDir}/${CONFIG_FILE}`);
    console.log(`  templates: ${templatesDir}/`);
    console.log(`  branches:  ${branchesDir}/ (gitignored)`);
  }

  const checkoutResult = await installHook(gitRoot, HookType.PostCheckout, promptYesNo);
  printHookInstallResult(checkoutResult, HOOK_POST_CHECKOUT);
  if (checkoutResult === HookInstallResult.AlreadyInstalled && alreadyInitialized) {
    console.log('Already initialized');
  }

  const commitResult = await installHook(gitRoot, HookType.PostCommit, promptYesNo);
  printHookInstallResult(commitResult, HOOK_POST_COMMIT);

  addToGitignore(gitRoot, DEFAULT_SYMLINK);
  addToGitignore(gitRoot, `${CONFIG_DIR}/${BRANCHES_DIR}/`);

  const branch = getCurrentBranch(gitRoot);
  if (branch) {
    syncBranch(gitRoot, branch);
    console.log(`Synced: ${branch}`);
  }

  return 0;
}

function printHookInstallResult(result: HookInstallResult, hookName: string) {
  const message = hookInstallMessages[result](hookName);
  if (message) {
    console.log(message);
  }
}
