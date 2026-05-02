import {
  CLI_NAME,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  HookType,
  HookUninstallResult,
  uninstallHook,
  unsetGlobalHooksPath,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

const hookUninstallMessages = {
  [HookUninstallResult.Uninstalled]: (hookName: string) => `Hook removed: ${hookName}`,
  [HookUninstallResult.NotManaged]: (hookName: string) =>
    `warning: ${hookName} hook exists but not managed by ${CLI_NAME}`,
  [HookUninstallResult.NotInstalled]: () => null,
} as const satisfies Record<HookUninstallResult, (hookName: string) => string | null>;

export function registerUninstallCommand(program: Program) {
  program
    .command('uninstall', 'Remove hook from current repo')
    .option('--global', 'Unset global hooks path')
    .action(({ options }) => cmdUninstall(options.global ? ['--global'] : []));
}

function cmdUninstall(args: string[]) {
  if (args.includes('--global')) {
    unsetGlobalHooksPath();
    console.log('Global hooks path unset');
    return 0;
  }

  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const checkoutResult = uninstallHook(gitRoot, HookType.PostCheckout);
  const commitResult = uninstallHook(gitRoot, HookType.PostCommit);

  printHookUninstallResult(checkoutResult, HOOK_POST_CHECKOUT);
  printHookUninstallResult(commitResult, HOOK_POST_COMMIT);

  if (
    checkoutResult === HookUninstallResult.NotInstalled &&
    commitResult === HookUninstallResult.NotInstalled
  ) {
    console.log('No hooks installed');
  }

  return 0;
}

function printHookUninstallResult(result: HookUninstallResult, hookName: string) {
  const message = hookUninstallMessages[result](hookName);
  if (message) {
    console.log(message);
  }
}
