import { getGitRoot } from '@branch-context/core';

export function requireGitRoot(options: { silent?: boolean } = {}) {
  const gitRoot = getGitRoot();
  if (!gitRoot && !options.silent) {
    console.log('error: not a git repository');
  }
  return gitRoot;
}
