import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveGlobalPath } from '../data/config';
import { syncCurrentBranch } from './actions';

export enum BackupGlobalStorageResultStatus {
  Pushed = 'pushed',
  NoChanges = 'no_changes',
}

export type BackupGlobalStorageResult =
  | {
      ok: true;
      status: BackupGlobalStorageResultStatus;
      globalPath: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
      globalPath?: string;
    };

export function backupGlobalStorage(workspaceRoot: string): BackupGlobalStorageResult {
  const globalPath = getActiveGlobalPath();
  if (!globalPath) {
    return { ok: false, message: 'global_path is not configured or does not exist' };
  }

  if (!existsSync(join(globalPath, '.git'))) {
    return {
      ok: false,
      globalPath,
      message: [
        'No Git repository found at global_path.',
        'Run:',
        `  cd ${globalPath}`,
        '  git init',
        '  git remote add origin <url>',
      ].join('\n'),
    };
  }

  if (!hasRemote(globalPath)) {
    return { ok: false, globalPath, message: 'no git remote configured for global_path' };
  }

  const syncResult = syncCurrentBranch(workspaceRoot, { sound: false });
  if (!syncResult.ok) {
    return { ok: false, globalPath, message: syncResult.message };
  }

  const addResult = git(globalPath, ['add', '.']);
  if (!addResult.ok) {
    return addResult;
  }

  if (!hasStagedDiff(globalPath)) {
    return {
      ok: true,
      status: BackupGlobalStorageResultStatus.NoChanges,
      globalPath,
      message: 'No changes to backup',
    };
  }

  const commitResult = git(globalPath, ['commit', '-m', 'backup: sync branch contexts']);
  if (!commitResult.ok) {
    return commitResult;
  }

  const pushResult = git(globalPath, ['push']);
  if (!pushResult.ok) {
    return pushResult;
  }

  return {
    ok: true,
    status: BackupGlobalStorageResultStatus.Pushed,
    globalPath,
    message: 'Backup pushed',
  };
}

function hasRemote(cwd: string) {
  const result = spawnSync('git', ['remote'], { cwd, encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function hasStagedDiff(cwd: string) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, encoding: 'utf8' });
  return result.status !== 0;
}

function git(cwd: string, args: string[]): BackupGlobalStorageResult {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status === 0) {
    return {
      ok: true,
      status: BackupGlobalStorageResultStatus.Pushed,
      globalPath: cwd,
      message: result.stdout.trim(),
    };
  }

  return {
    ok: false,
    globalPath: cwd,
    message: result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`,
  };
}
