import { existsSync } from 'node:fs';
import { CLI_NAME } from '../constants';
import { getCurrentBranch, getGitRoot } from '../core/hooks';
import { getBranchDir } from '../core/sync';
import { getBaseBranch, saveBaseBranch } from '../data/branch-base';
import { configExists } from '../data/config';

export function cmdBase(args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  if (!configExists(gitRoot)) {
    console.log(`error: not initialized. Run '${CLI_NAME} init' first`);
    return 1;
  }

  const branch = getCurrentBranch(gitRoot);
  if (!branch) {
    console.log('error: could not determine current branch');
    return 1;
  }

  const branchDir = getBranchDir(gitRoot, branch);
  if (!existsSync(branchDir)) {
    console.log(`error: no context for '${branch}'. Run '${CLI_NAME} sync' first`);
    return 1;
  }

  if (args.length === 0) {
    console.log(getBaseBranch(gitRoot, branchDir));
    return 0;
  }

  const newBase = args[0] ?? '';
  saveBaseBranch(branchDir, newBase);
  console.log(`Base branch set to '${newBase}' for '${branch}'`);
  return 0;
}
