import {
  BranchContextActionErrorReason,
  CLI_NAME,
  Config,
  CreateBranchContextResult,
  playSound,
  syncCurrentBranch,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

export function registerSyncCommand(program: Program) {
  program.command('sync', 'Sync context and update meta/tags').action(() => cmdSync([]));
}

function cmdSync(_args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const config = Config.load(gitRoot);
  const result = syncCurrentBranch(gitRoot, {
    sound: config.sound,
    playSound,
  });
  if (!result.ok) {
    if (result.reason === BranchContextActionErrorReason.NotInitialized) {
      console.log(`error: not initialized. Run '${CLI_NAME} init' first`);
    } else if (result.reason === BranchContextActionErrorReason.NoCurrentBranch) {
      console.log('error: could not determine current branch');
    } else {
      console.log(`error: ${result.message}`);
    }
    return 1;
  }

  console.log(`Branch:  ${result.branch}`);
  console.log(`Context: ${result.contextDir}`);
  console.log(`Symlink: ${result.symlinkPath} -> ${result.contextDir}`);
  console.log(`Base:    ${result.baseBranch}`);

  if (result.createResult === CreateBranchContextResult.CreatedFromTemplate) {
    console.log('Status:  created from template');
  } else if (result.createResult === CreateBranchContextResult.RepairedFromTemplate) {
    console.log('Status:  repaired from template');
  } else if (result.createResult === CreateBranchContextResult.CreatedEmpty) {
    console.log('Status:  created (no template)');
  } else {
    console.log('Status:  synced');
  }

  if (result.updates.length > 0) {
    console.log(`Updated: ${result.updates.length} tag(s)`);
  }

  return 0;
}
