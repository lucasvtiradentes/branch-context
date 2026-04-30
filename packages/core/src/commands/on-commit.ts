import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DEFAULT_SYMLINK } from '../constants';
import { updateContextTags } from '../core/context-tags';
import { getCurrentBranch, getGitRoot } from '../core/hooks';
import { sanitizeBranchName } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { Config, configExists } from '../data/config';
import { updateBranchMeta } from '../data/meta';

export function cmdOnCommit(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    return 1;
  }

  if (!configExists(gitRoot)) {
    return 0;
  }

  const branch = getCurrentBranch(gitRoot);
  if (!branch) {
    return 0;
  }

  const branchKey = sanitizeBranchName(branch);
  const contextDir = join(gitRoot, DEFAULT_SYMLINK);
  if (!existsSync(contextDir)) {
    return 0;
  }

  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);
  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);

  const updates = updateContextTags(gitRoot, contextDir, branchKey, baseBranch);
  if (updates.length > 0) {
    console.log(`Updated ${updates.length} tag(s) in context files:`);
    for (const update of updates) {
      console.log(`  ${relative(gitRoot, update.file)}: <${update.tag}>`);
    }
  }

  return 0;
}
