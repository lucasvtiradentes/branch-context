import { relative } from 'node:path';
import { syncBranchAfterCommit } from '@branch-context/core';
import { createCommandAdapters } from 'unicommand';
import { defineCliCommand } from '../helpers/command';
import { requireGitRoot } from '../helpers/git-root';

const metadata = defineCliCommand({
  name: 'on-commit',
  description: 'Run post-commit hook callback',
  config: { visible: false },
});

export const { handler: onCommitHandler, cli: onCommitCli } = createCommandAdapters({
  metadata,
  handler,
});

function handler() {
  const gitRoot = requireGitRoot({ silent: true });
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
