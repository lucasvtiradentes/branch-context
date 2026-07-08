import { backupGlobalStorage } from '@branch-context/core';
import { createCommandAdapters, defineCommand } from 'unicommand';
import { requireGitRoot } from '../helpers/git-root';

const metadata = defineCommand({
  name: 'backup',
  description: 'Sync and push global storage',
});

export const backupCommand = createCommandAdapters({
  metadata,
  handler,
});

function handler() {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const result = backupGlobalStorage(gitRoot);
  if (!result.ok) {
    console.log(`error: ${result.message}`);
    return 1;
  }

  console.log(result.message);
  return 0;
}
