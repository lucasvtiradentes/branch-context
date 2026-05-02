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

const syncErrorMessages = {
  [BranchContextActionErrorReason.NotInitialized]: () =>
    `error: not initialized. Run '${CLI_NAME} init' first`,
  [BranchContextActionErrorReason.NoCurrentBranch]: () =>
    'error: could not determine current branch',
  [BranchContextActionErrorReason.MissingContext]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.BaseBranchNotFound]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.NoTemplates]: (message: string) => `error: ${message}`,
  [BranchContextActionErrorReason.TemplateNotFound]: (message: string) => `error: ${message}`,
} as const satisfies Record<BranchContextActionErrorReason, (message: string) => string>;
const createResultStatuses: Partial<Record<CreateBranchContextResult, string>> = {
  [CreateBranchContextResult.CreatedFromTemplate]: 'created from template',
  [CreateBranchContextResult.RepairedFromTemplate]: 'repaired from template',
  [CreateBranchContextResult.CreatedEmpty]: 'created (no template)',
};

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
    console.log(syncErrorMessages[result.reason](result.message));
    return 1;
  }

  console.log(`Branch:  ${result.branch}`);
  console.log(`Context: ${result.contextDir}`);
  console.log(`Symlink: ${result.symlinkPath} -> ${result.contextDir}`);
  console.log(`Base:    ${result.baseBranch}`);

  console.log(`Status:  ${createResultStatuses[result.createResult] ?? 'synced'}`);

  if (result.updates.length > 0) {
    console.log(`Updated: ${result.updates.length} tag(s)`);
  }

  return 0;
}
