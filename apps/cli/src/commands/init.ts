import {
  BranchContextActionErrorReason,
  CLI_NAME,
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
  program
    .command('init', 'Initialize and install hook')
    .option('--shared-path <path>', 'Shared storage path override')
    .action(({ options }) =>
      cmdInit(typeof options.sharedPath === 'string' ? ['--shared-path', options.sharedPath] : []),
    );
}

export async function runInitCommand(args: string[]) {
  return await cmdInit(args);
}

async function cmdInit(args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const result = await initProject(gitRoot, promptYesNo, {
    sharedPath: argValue(args, '--shared-path'),
  });
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
    console.log(`Initialized: ${result.mode}`);
    if (result.sharedPath) {
      console.log(`  storage:   ${result.sharedPath}`);
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
