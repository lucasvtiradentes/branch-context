import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveSharedPath, syncCurrentBranch } from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../helpers/git-root';

export function registerBackupCommand(program: Program) {
  program.command('backup', 'Sync and push shared storage').action(() => cmdBackup());
}

function cmdBackup() {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const sharedPath = getActiveSharedPath();
  if (!sharedPath) {
    console.log('error: shared_path is not configured or does not exist');
    return 1;
  }

  if (!existsSync(join(sharedPath, '.git'))) {
    console.log('No Git repository found at shared_path.');
    console.log('Run:');
    console.log(`  cd ${sharedPath}`);
    console.log('  git init');
    console.log('  git remote add origin <url>');
    return 1;
  }

  if (!hasRemote(sharedPath)) {
    console.log('error: no git remote configured for shared_path');
    return 1;
  }

  const syncResult = syncCurrentBranch(gitRoot, { sound: false });
  if (!syncResult.ok) {
    console.log(`error: ${syncResult.message}`);
    return 1;
  }

  git(sharedPath, ['add', '.']);
  if (!hasDiff(sharedPath)) {
    console.log('No changes to backup');
    return 0;
  }

  git(sharedPath, ['commit', '-m', 'backup: sync branch contexts']);
  git(sharedPath, ['push']);
  console.log('Backup pushed');
  return 0;
}

function hasRemote(cwd: string) {
  try {
    return git(cwd, ['remote']).trim().length > 0;
  } catch {
    return false;
  }
}

function hasDiff(cwd: string) {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
