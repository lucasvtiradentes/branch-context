import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLI_NAME,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
} from '../constants';
import { getCurrentBranch, getGitRoot, isHookInstalled } from '../core/hooks';
import { getBranchDir, listArchivedBranches } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { configExists, getTemplatesDir, listTemplates } from '../data/config';
import { green, red, yellow } from '../utils/color';
import { collectBranchInfo, printTable } from './_branches';

const STATUS_OK = green('[ok]');
const STATUS_ERROR = red('[!!]');
const STATUS_WARN = yellow('[--]');

export function cmdStatus(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  if (!configExists(gitRoot)) {
    console.log(`error: ${CLI_NAME} not initialized`);
    console.log(`run: ${CLI_NAME} init`);
    return 1;
  }

  const branch = getCurrentBranch(gitRoot);
  const symlinkPath = join(gitRoot, DEFAULT_SYMLINK);
  const symlinkTarget = isSymlink(symlinkPath) ? readlinkSync(symlinkPath) : null;

  console.log(`Branch:      ${branch}`);
  const branchDir = getBranchDir(gitRoot, branch ?? '');
  console.log(`Base:        ${getBaseBranch(gitRoot, branchDir)}`);

  const templates = listTemplates(gitRoot);
  console.log(`Templates:   ${templates.length > 0 ? [...templates].sort().join(', ') : 'none'}`);

  const hasCheckoutHook = isHookInstalled(gitRoot, HOOK_POST_CHECKOUT);
  const hasCommitHook = isHookInstalled(gitRoot, HOOK_POST_COMMIT);
  const allNames = collectBranchInfo(gitRoot);

  console.log();
  console.log('Health:');

  const issues: string[] = [];

  if (hasCheckoutHook) {
    console.log(`  ${STATUS_OK} ${HOOK_POST_CHECKOUT} hook installed`);
  } else {
    issues.push(`${HOOK_POST_CHECKOUT} hook not installed`);
    console.log(`  ${STATUS_ERROR} ${HOOK_POST_CHECKOUT} hook not installed`);
  }

  if (hasCommitHook) {
    console.log(`  ${STATUS_OK} ${HOOK_POST_COMMIT} hook installed`);
  } else {
    issues.push(`${HOOK_POST_COMMIT} hook not installed`);
    console.log(`  ${STATUS_ERROR} ${HOOK_POST_COMMIT} hook not installed`);
  }

  const templatesDir = getTemplatesDir(gitRoot);
  if (existsSync(templatesDir)) {
    console.log(`  ${STATUS_OK} templates/ exists`);
  } else {
    issues.push('templates/ missing');
    console.log(`  ${STATUS_ERROR} templates/ missing`);
  }

  if (templates.includes(DEFAULT_TEMPLATE)) {
    console.log(`  ${STATUS_OK} ${DEFAULT_TEMPLATE} template exists`);
  } else {
    issues.push(`${DEFAULT_TEMPLATE} template missing`);
    console.log(`  ${STATUS_ERROR} ${DEFAULT_TEMPLATE} template missing`);
  }

  if (isSymlink(symlinkPath)) {
    if (symlinkTarget && existsSync(join(gitRoot, symlinkTarget))) {
      console.log(`  ${STATUS_OK} symlink valid`);
    } else {
      issues.push('symlink points to non-existent target');
      console.log(`  ${STATUS_ERROR} symlink broken -> ${symlinkTarget}`);
    }
  } else if (existsSync(symlinkPath)) {
    issues.push('symlink path exists but is not a symlink');
    console.log(`  ${STATUS_ERROR} ${DEFAULT_SYMLINK} is not a symlink`);
  } else {
    console.log(`  ${STATUS_WARN} symlink not set`);
  }

  const orphans = Array.from(allNames.entries()).filter(([, info]) => info.context && !info.local);
  if (orphans.length > 0) {
    console.log(`  ${STATUS_WARN} ${orphans.length} orphan contexts`);
  } else {
    console.log(`  ${STATUS_OK} no orphan contexts`);
  }

  if (allNames.size > 0) {
    const contextCount = Array.from(allNames.values()).filter((info) => info.context).length;
    const archivedCount = listArchivedBranches(gitRoot).length;
    console.log(`\nBranches (${contextCount} contexts, ${archivedCount} archived):\n`);
    printTable(allNames, branch);
  }

  return issues.length > 0 ? 1 : 0;
}

function isSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
