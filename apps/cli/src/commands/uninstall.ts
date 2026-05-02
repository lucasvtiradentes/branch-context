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

  if (checkoutResult === HookUninstallResult.Uninstalled) {
    console.log(`Hook removed: ${HOOK_POST_CHECKOUT}`);
  } else if (checkoutResult === HookUninstallResult.NotManaged) {
    console.log(`warning: ${HOOK_POST_CHECKOUT} hook exists but not managed by ${CLI_NAME}`);
  }

  if (commitResult === HookUninstallResult.Uninstalled) {
    console.log(`Hook removed: ${HOOK_POST_COMMIT}`);
  } else if (commitResult === HookUninstallResult.NotManaged) {
    console.log(`warning: ${HOOK_POST_COMMIT} hook exists but not managed by ${CLI_NAME}`);
  }

  if (
    checkoutResult === HookUninstallResult.NotInstalled &&
    commitResult === HookUninstallResult.NotInstalled
  ) {
    console.log('No hooks installed');
  }

  return 0;
}
