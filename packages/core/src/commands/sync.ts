import { CLI_NAME } from '../constants';
import { updateContextTags } from '../core/context-tags';
import { getCurrentBranch, getGitRoot } from '../core/hooks';
import { sanitizeBranchName, syncBranch } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { Config, configExists } from '../data/config';
import { updateBranchMeta } from '../data/meta';

export function cmdSync(_args: string[]) {
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

  const result = syncBranch(gitRoot, branch);
  const branchKey = sanitizeBranchName(branch);
  const contextDir = result.branch_dir;
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);

  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);
  const updates = updateContextTags(gitRoot, contextDir, branchKey, baseBranch);

  console.log(`Branch:  ${result.branch}`);
  console.log(`Context: ${result.branch_dir}`);
  console.log(`Symlink: ${result.symlink_path} -> ${result.branch_dir}`);
  console.log(`Base:    ${baseBranch}`);

  if (result.create_result === 'created_from_template') {
    console.log('Status:  created from template');
  } else if (result.create_result === 'created_empty') {
    console.log('Status:  created (no template)');
  } else {
    console.log('Status:  synced');
  }

  if (updates.length > 0) {
    console.log(`Updated: ${updates.length} tag(s)`);
  }

  return 0;
}
