import {
  CLI_NAME,
  getGitRoot,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  uninstallHook,
  unsetGlobalHooksPath,
} from '@branch-context/core';

export function cmdUninstall(args: string[]) {
  if (args.includes('--global')) {
    unsetGlobalHooksPath();
    console.log('Global hooks path unset');
    return 0;
  }

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  const checkoutResult = uninstallHook(gitRoot, HOOK_POST_CHECKOUT);
  const commitResult = uninstallHook(gitRoot, HOOK_POST_COMMIT);

  if (checkoutResult === 'uninstalled') {
    console.log(`Hook removed: ${HOOK_POST_CHECKOUT}`);
  } else if (checkoutResult === 'not_managed') {
    console.log(`warning: ${HOOK_POST_CHECKOUT} hook exists but not managed by ${CLI_NAME}`);
  }

  if (commitResult === 'uninstalled') {
    console.log(`Hook removed: ${HOOK_POST_COMMIT}`);
  } else if (commitResult === 'not_managed') {
    console.log(`warning: ${HOOK_POST_COMMIT} hook exists but not managed by ${CLI_NAME}`);
  }

  if (checkoutResult === 'not_installed' && commitResult === 'not_installed') {
    console.log('No hooks installed');
  }

  return 0;
}
