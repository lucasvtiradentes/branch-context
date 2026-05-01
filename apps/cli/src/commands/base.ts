import { CLI_NAME, getCurrentBase, getGitRoot, setCurrentBase } from '@branch-context/core';

export function cmdBase(args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
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

function renderBaseError(result: { reason: string; message: string; branch?: string }) {
  if (result.reason === 'not_initialized') {
    console.log(`error: not initialized. Run '${CLI_NAME} init' first`);
  } else if (result.reason === 'no_current_branch') {
    console.log('error: could not determine current branch');
  } else if (result.reason === 'missing_context') {
    console.log(`error: no context for '${result.branch}'. Run '${CLI_NAME} sync' first`);
  } else {
    console.log(`error: ${result.message}`);
  }
  return 1;
}
