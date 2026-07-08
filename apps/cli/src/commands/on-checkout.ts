import { CLI_NAME, syncBranchAfterCheckout } from '@branch-context/core';
import { createCommandAdapters, defineCommand } from 'unicommand';
import { requireGitRoot } from '../helpers/git-root';

const metadata = defineCommand({
  name: 'on-checkout',
  description: 'Run post-checkout hook callback',
  config: { visible: false },
  arguments: [
    { synopsis: '<old-branch>', description: 'Old branch' },
    { synopsis: '<new-branch>', description: 'New branch' },
  ],
});

export const onCheckoutCommand = createCommandAdapters({
  metadata,
  handler,
});

function handler({ oldBranch, newBranch }: { oldBranch?: unknown; newBranch?: unknown }) {
  if (oldBranch === undefined || newBranch === undefined) {
    console.log(`usage: ${CLI_NAME} on-checkout <old_branch> <new_branch>`);
    return 1;
  }

  const oldBranchName = String(oldBranch);
  const newBranchName = String(newBranch);
  const gitRoot = requireGitRoot({ silent: true });
  if (!gitRoot) {
    return 1;
  }

  const result = syncBranchAfterCheckout(gitRoot, newBranchName);
  if (result.skipped) {
    console.log(`Branch: ${oldBranchName} -> ${newBranchName}`);
    return 0;
  }

  console.log(`Branch: ${oldBranchName} -> ${newBranchName} (${result.status})`);
  return 0;
}
