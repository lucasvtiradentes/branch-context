import { relative } from 'node:path';
import { getGitRoot, syncBranchAfterCommit } from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerOnCommitCommand(program: Program) {
  program
    .command('on-commit', 'Run post-commit hook callback', { visible: false })
    .action(() => cmdOnCommit([]));
}

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
