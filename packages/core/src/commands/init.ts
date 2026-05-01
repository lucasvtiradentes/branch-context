import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLI_NAME,
  CONFIG_FILE,
  DEFAULT_SYMLINK,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
} from '../constants';
import { getCurrentBranch, getGitRoot, installHook } from '../core/hooks';
import { copyInitTemplates, syncBranch } from '../core/sync';
import {
  configExists,
  copyInitConfig,
  getBranchesDir,
  getConfigDir,
  getTemplatesDir,
} from '../data/config';

export async function cmdInit(_args: string[]) {
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

export function addToGitignore(gitRoot: string, value: string) {
  const gitignoreFile = join(gitRoot, '.gitignore');
  let existing = '';

  if (existsSync(gitignoreFile)) {
    existing = readFileSync(gitignoreFile, 'utf8');
  }

  if (!existing.split(/\r?\n/).includes(value)) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(gitignoreFile, `${existing}${prefix}${value}\n`);
  }
}
