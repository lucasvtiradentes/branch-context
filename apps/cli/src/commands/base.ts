import {
  BranchContextActionErrorReason,
  getCurrentBase,
  setCurrentBase,
} from '@branch-context/core';
import { createCommandAdapters, defineCommand } from 'unicommand';
import { requireGitRoot } from '../helpers/git-root';

const baseErrorMessages = {
  [BranchContextActionErrorReason.NotInitialized]: () => "error: not initialized. Run 'init' first",
  [BranchContextActionErrorReason.NoCurrentBranch]: () =>
    'error: could not determine current branch',
  [BranchContextActionErrorReason.MissingContext]: (result: { branch?: string }) =>
    `error: no context for '${result.branch}'. Run 'sync' first`,
  [BranchContextActionErrorReason.BaseBranchNotFound]: (result: { message: string }) =>
    `error: ${result.message}`,
  [BranchContextActionErrorReason.NoTemplates]: (result: { message: string }) =>
    `error: ${result.message}`,
  [BranchContextActionErrorReason.TemplateNotFound]: (result: { message: string }) =>
    `error: ${result.message}`,
  [BranchContextActionErrorReason.InvalidPath]: (result: { message: string }) =>
    `error: ${result.message}`,
} as const satisfies Record<
  BranchContextActionErrorReason,
  (result: { message: string; branch?: string }) => string
>;

const metadata = defineCommand({
  name: 'base',
  description: 'Show or set base branch',
  arguments: [{ synopsis: '[branch]', description: 'Base branch' }],
});

export const baseCommand = createCommandAdapters({
  metadata,
  handler,
});

function handler({ branch }: { branch?: unknown }) {
  const args = stringArgs(branch);
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  if (args.length === 0) {
    const result = getCurrentBase(gitRoot);
    if (!result.ok) {
      return renderBaseError(result);
    }
    console.log(result.baseBranch);
    return 0;
  }

  const newBase = args[0] ?? '';
  const result = setCurrentBase(gitRoot, newBase);
  if (!result.ok) {
    return renderBaseError(result);
  }

  console.log(`Base branch set to '${result.baseBranch}' for '${result.branch}'`);
  return 0;
}

function stringArgs(value: unknown) {
  return value == null || value === '' ? [] : [String(value)];
}

function renderBaseError(result: {
  reason: BranchContextActionErrorReason;
  message: string;
  branch?: string;
}) {
  console.log(baseErrorMessages[result.reason](result));
  return 1;
}
