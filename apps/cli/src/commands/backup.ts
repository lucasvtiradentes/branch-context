import { backupGlobalStorage } from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

export function registerBackupCommand(program: Program) {
  program.command('backup', 'Sync and push global storage').action(() => cmdBackup());
}

function cmdBackup() {
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
