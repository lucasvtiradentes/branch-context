import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveGlobalPath, syncCurrentBranch } from '@branch-context/core';
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

  const globalPath = getActiveGlobalPath();
  if (!globalPath) {
    console.log('error: global_path is not configured or does not exist');
    return 1;
  }

  if (!existsSync(join(globalPath, '.git'))) {
    console.log('No Git repository found at global_path.');
    console.log('Run:');
    console.log(`  cd ${globalPath}`);
    console.log('  git init');
    console.log('  git remote add origin <url>');
    return 1;
  }

  if (!hasRemote(globalPath)) {
    console.log('error: no git remote configured for global_path');
    return 1;
  }

  const syncResult = syncCurrentBranch(gitRoot, { sound: false });
  if (!syncResult.ok) {
    console.log(`error: ${syncResult.message}`);
    return 1;
  }

  git(globalPath, ['add', '.']);
  if (!hasDiff(globalPath)) {
    console.log('No changes to backup');
    return 0;
  }

  git(globalPath, ['commit', '-m', 'backup: sync branch contexts']);
  git(globalPath, ['push']);
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
