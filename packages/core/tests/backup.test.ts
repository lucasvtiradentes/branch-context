import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupGlobalStorage } from '../src/index';
import { createGitRepo, createTempDir } from './helpers';

const originalHome = process.env.HOME;

function useEmptyHome() {
  process.env.HOME = createTempDir();
}

afterEach(() => {
  process.env.HOME = originalHome;
});

describe('backup global storage', () => {
  it('fails when workspace is not using global storage', () => {
    useEmptyHome();
    const repo = createGitRepo();

    const result = backupGlobalStorage(repo);

    expect(result).toEqual({
      ok: false,
      message: 'workspace is not using global storage',
    });
  });

  it('uses workspace global path inferred from symlink', () => {
    useEmptyHome();
    const repo = createGitRepo();
    const globalPath = join(createTempDir(), 'branches');
    const workspaceConfigDir = join(globalPath, 'repos', 'github.com-owner-repo');
    mkdirSync(workspaceConfigDir, { recursive: true });
    symlinkSync(workspaceConfigDir, join(repo, '.bctx'));

    const result = backupGlobalStorage(repo);

    expect(result.ok).toBe(false);
    expect(result.globalPath).toBe(realpathSync(globalPath));
    expect(result.message).toContain('No Git repository found at global_path.');
  });
});
