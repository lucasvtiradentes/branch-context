import {
  CLI_NAME,
  Config,
  CreateBranchContextResult,
  configExists,
  getBaseBranch,
  sanitizeBranchName,
  syncBranch,
  updateBranchMeta,
  updateContextTags,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

export function registerOnCheckoutCommand(program: Program) {
  program
    .command('on-checkout', 'Run post-checkout hook callback', { visible: false })
    .argument('<old-branch>', 'Old branch')
    .argument('<new-branch>', 'New branch')
    .action(({ args }) => cmdOnCheckout([String(args.oldBranch), String(args.newBranch)]));
}

function cmdOnCheckout(args: string[]) {
  if (args.length < 2) {
    console.log(`usage: ${CLI_NAME} on-checkout <old_branch> <new_branch>`);
    return 1;
  }

  const oldBranch = args[0] ?? '';
  const newBranch = args[1] ?? '';
  const gitRoot = requireGitRoot({ silent: true });
  if (!gitRoot) {
    return 1;
  }

  if (!configExists(gitRoot)) {
    console.log(`Branch: ${oldBranch} -> ${newBranch}`);
    return 0;
  }

  const result = syncBranch(gitRoot, newBranch);
  const branchKey = sanitizeBranchName(newBranch);
  const contextDir = result.branch_dir;
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);

  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);
  updateContextTags(gitRoot, contextDir, branchKey, baseBranch);

  const createResult = result.create_result;
  const status =
    createResult === CreateBranchContextResult.RestoredFromArchive
      ? 'restored'
      : createResult === CreateBranchContextResult.RepairedFromTemplate
        ? 'repaired'
        : createResult !== CreateBranchContextResult.Exists
          ? 'new'
          : 'synced';
  console.log(`Branch: ${oldBranch} -> ${newBranch} (${status})`);
  return 0;
}
