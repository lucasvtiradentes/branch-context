import { relative } from 'node:path';
import { getGitRoot } from '../core/hooks';
import { syncBranchAfterCommit } from '../services/commit-sync';

export function cmdOnCommit(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const result = syncBranchAfterCommit(gitRoot);
  if (!result.skipped && result.updates.length > 0) {
    console.log(`Updated ${result.updates.length} tag(s) in context files:`);
    for (const update of result.updates) {
      console.log(`  ${relative(gitRoot, update.file)}: <${update.tag}>`);
    }
  }

  return 0;
}
