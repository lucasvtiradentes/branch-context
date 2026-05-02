import { mkdirSync } from 'node:fs';
import {
  addToGitignore,
  CLI_NAME,
  CONFIG_FILE,
  configExists,
  copyInitConfig,
  copyInitTemplates,
  DEFAULT_SYMLINK,
  getBranchesDir,
  getConfigDir,
  getCurrentBranch,
  getGitRoot,
  getTemplatesDir,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  installHook,
  syncBranch,
} from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerInitCommand(program: Program) {
  program.command('init', 'Initialize and install hook').action(() => cmdInit([]));
}

async function cmdInit(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
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

  const checkoutResult = await installHook(gitRoot, HOOK_POST_CHECKOUT);
  if (checkoutResult === 'installed') {
    console.log(`Hook installed: ${HOOK_POST_CHECKOUT}`);
  } else if (checkoutResult === 'updated') {
    console.log(`Hook updated: ${HOOK_POST_CHECKOUT}`);
  } else if (checkoutResult === 'appended') {
    console.log(`Hook appended: ${HOOK_POST_CHECKOUT}`);
  } else if (checkoutResult === 'already_installed') {
    if (alreadyInitialized) {
      console.log('Already initialized');
    }
  } else if (checkoutResult === 'hook_exists') {
    console.log(`warning: ${HOOK_POST_CHECKOUT} hook exists but not managed by ${CLI_NAME}`);
  }

  const commitResult = await installHook(gitRoot, HOOK_POST_COMMIT);
  if (commitResult === 'installed') {
    console.log(`Hook installed: ${HOOK_POST_COMMIT}`);
  } else if (commitResult === 'updated') {
    console.log(`Hook updated: ${HOOK_POST_COMMIT}`);
  } else if (commitResult === 'appended') {
    console.log(`Hook appended: ${HOOK_POST_COMMIT}`);
  } else if (commitResult === 'hook_exists') {
    console.log(`warning: ${HOOK_POST_COMMIT} hook exists but not managed by ${CLI_NAME}`);
  }

  addToGitignore(gitRoot, DEFAULT_SYMLINK);
  addToGitignore(gitRoot, '.bctx/branches/');

  const branch = getCurrentBranch(gitRoot);
  if (branch) {
    syncBranch(gitRoot, branch);
    console.log(`Synced: ${branch}`);
  }

  return 0;
}
