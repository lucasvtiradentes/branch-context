import {
  BranchContextActionErrorReason,
  DEFAULT_SYMLINK,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  HookInstallResult,
  type InitProjectResult,
  initProject,
  UpdateSymlinkResult,
} from '@branch-context/core';
import { createCommandAdapters, defineCommand } from 'unicommand';
import { requireGitRoot } from '../helpers/git-root';
import { promptYesNo } from '../ui/prompt';

const hookInstallMessages = {
  [HookInstallResult.Installed]: (hookName: string) => `Hook installed: ${hookName}`,
  [HookInstallResult.Updated]: (hookName: string) => `Hook updated: ${hookName}`,
  [HookInstallResult.Appended]: (hookName: string) => `Hook appended: ${hookName}`,
  [HookInstallResult.HookExists]: (hookName: string) =>
    `warning: ${hookName} hook exists but not managed by branch-context`,
  [HookInstallResult.AlreadyInstalled]: () => null,
} as const satisfies Record<HookInstallResult, (hookName: string) => string | null>;

const metadata = defineCommand({
  name: 'init',
  description: 'Initialize and install hook',
});

export const initCommand = createCommandAdapters({
  metadata,
  handler,
});

async function handler() {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const result = await initProject(gitRoot, promptYesNo);
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

function printInitResult(result: Extract<InitProjectResult, { ok: true }>) {
  if (!result.alreadyInitialized) {
    console.log(`Initialized: ${result.mode}`);
    if (result.globalPath) {
      console.log(`  storage:   ${result.globalPath}`);
      console.log(`  symlink:   .bctx -> ${result.configDir}`);
    }
    console.log(`  config:    ${result.configPath}`);
    console.log(`  templates: ${result.templatesDir}/`);
    console.log(`  branches:  ${result.branchesDir}/`);
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
