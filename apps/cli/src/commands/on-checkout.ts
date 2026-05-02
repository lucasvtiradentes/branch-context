import { CLI_NAME, syncBranchAfterCheckout } from '@branch-context/core';
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

  const result = syncBranchAfterCheckout(gitRoot, newBranch);
  if (result.skipped) {
    console.log(`Branch: ${oldBranch} -> ${newBranch}`);
    return 0;
  }

  console.log(`Branch: ${oldBranch} -> ${newBranch} (${result.status})`);
  return 0;
}
