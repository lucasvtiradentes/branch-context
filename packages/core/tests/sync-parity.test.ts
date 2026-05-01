import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  archiveBranch,
  branchContextExists,
  Config,
  createBranchContext,
  DEFAULT_SYMLINK,
  deleteBranchContext,
  getBranchDir,
  getBranchRelPath,
  getCurrentBase,
  initProject,
  listArchivedBranches,
  listBranches,
  resetBranchContext,
  setCurrentBase,
  syncBranch,
  syncCurrentBranch,
  updateSymlink,
} from '../src/index';
import { gitAdd, gitCheckout, gitCommit } from '../src/utils/git';
import {
  createGitRepo,
  createWorkspace,
  createWorkspaceNoTemplate,
  initBctxWorkspace,
} from './helpers';

function normalize(path: string) {
  return path.replaceAll('\\', '/');
}

describe('sync parity', () => {
  it('creates branch context from template', () => {
    const workspace = createWorkspace();
    expect(createBranchContext(workspace, 'main')).toBe('created_from_template');
    expect(existsSync(getBranchDir(workspace, 'main'))).toBe(true);
    expect(existsSync(join(getBranchDir(workspace, 'main'), 'context.md'))).toBe(true);
  });

  it('returns exists for existing branch context', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    expect(createBranchContext(workspace, 'main')).toBe('exists');
  });

  it('repairs existing branch context missing context file', () => {
    const workspace = createWorkspace();
    const branchDir = getBranchDir(workspace, 'main');
    mkdirSync(branchDir, { recursive: true });
    expect(createBranchContext(workspace, 'main')).toBe('repaired_from_template');
    expect(existsSync(join(branchDir, 'context.md'))).toBe(true);
  });

  it('checks branch context existence', () => {
    const workspace = createWorkspace();
    expect(branchContextExists(workspace, 'main')).toBe(false);
    createBranchContext(workspace, 'main');
    expect(branchContextExists(workspace, 'main')).toBe(true);
  });

  it('updates symlink', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    expect(updateSymlink(workspace, 'main')).toBe('updated');
    expect(existsSync(join(workspace, DEFAULT_SYMLINK))).toBe(true);
  });

  it('returns unchanged for already current symlink', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    updateSymlink(workspace, 'main');
    expect(updateSymlink(workspace, 'main')).toBe('unchanged');
  });

  it('lists branches', () => {
    const workspace = createWorkspace();
    expect(listBranches(workspace)).toEqual([]);
    createBranchContext(workspace, 'main');
    createBranchContext(workspace, 'feature/login');
    expect(listBranches(workspace).sort()).toEqual(['feature-login', 'main']);
  });

  it('creates branch context without template', () => {
    const workspace = createWorkspaceNoTemplate();
    expect(createBranchContext(workspace, 'main')).toBe('created_empty');
    expect(readdirSync(getBranchDir(workspace, 'main'))).toEqual([]);
  });

  it('returns error when symlink path is regular file', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    writeFileSync(join(workspace, DEFAULT_SYMLINK), 'regular file');
    expect(updateSymlink(workspace, 'main')).toBe('error_not_symlink');
  });

  it('syncs branch and returns result object', () => {
    const workspace = createWorkspace();
    const result = syncBranch(workspace, 'feature/test');
    expect(result.branch).toBe('feature/test');
    expect(result.branch_dir).toContain('feature-test');
    expect(result.create_result).toBe('created_from_template');
    expect(result.symlink_result).toBe('updated');
    expect(result.symlink_path).toBe(DEFAULT_SYMLINK);
  });

  it('switches symlink between branches', () => {
    const workspace = createWorkspace();
    const symlinkPath = join(workspace, DEFAULT_SYMLINK);
    createBranchContext(workspace, 'main');
    createBranchContext(workspace, 'feature');
    updateSymlink(workspace, 'main');
    expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath('main'));
    updateSymlink(workspace, 'feature');
    expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath('feature'));
    updateSymlink(workspace, 'main');
    expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath('main'));
  });

  it('isolates branch content', () => {
    const workspace = createWorkspace();
    const symlinkPath = join(workspace, DEFAULT_SYMLINK);
    syncBranch(workspace, 'main');
    writeFileSync(join(symlinkPath, 'context.md'), 'MAIN CONTENT');
    syncBranch(workspace, 'feature');
    writeFileSync(join(symlinkPath, 'context.md'), 'FEATURE CONTENT');
    syncBranch(workspace, 'main');
    expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe('MAIN CONTENT');
    syncBranch(workspace, 'feature');
    expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe('FEATURE CONTENT');
  });

  it('handles multiple branch switches', () => {
    const workspace = createWorkspace();
    const symlinkPath = join(workspace, DEFAULT_SYMLINK);
    const branches = ['main', 'dev', 'feature/a', 'feature/b'];
    for (const branch of branches) {
      const result = syncBranch(workspace, branch);
      expect(['updated', 'unchanged']).toContain(result.symlink_result);
    }
    for (const branch of branches) {
      syncBranch(workspace, branch);
      expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath(branch));
    }
  });

  it('creates branch context with template rules', () => {
    const workspace = createWorkspace();
    new Config({ templateRules: [{ prefix: 'feature/', template: 'feature' }] }).save(workspace);
    expect(createBranchContext(workspace, 'feature/login')).toBe('created_from_template');
    const content = readFileSync(
      join(getBranchDir(workspace, 'feature/login'), 'context.md'),
      'utf8',
    );
    expect(content).toContain('## Description');
    expect(content).toContain('## Decisions');
  });

  it('resets branch context', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    const branchDir = getBranchDir(workspace, 'main');
    writeFileSync(join(branchDir, 'context.md'), 'MODIFIED CONTENT');
    expect(resetBranchContext(workspace, 'main')).toBe('reset');
    const content = readFileSync(join(branchDir, 'context.md'), 'utf8');
    expect(content).toContain('branch:');
    expect(content).not.toContain('MODIFIED CONTENT');
  });

  it('preserves extra files when resetting branch context', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    const branchDir = getBranchDir(workspace, 'main');
    writeFileSync(join(branchDir, 'notes.md'), 'my notes');
    mkdirSync(join(branchDir, 'attachments'));
    writeFileSync(join(branchDir, 'attachments', 'diagram.png'), 'fake png');
    expect(resetBranchContext(workspace, 'main')).toBe('reset');
    expect(existsSync(join(branchDir, 'notes.md'))).toBe(true);
    expect(existsSync(join(branchDir, 'attachments', 'diagram.png'))).toBe(true);
  });

  it('resets branch context with specific template', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    expect(resetBranchContext(workspace, 'main', 'feature')).toBe('reset');
    expect(readFileSync(join(getBranchDir(workspace, 'main'), 'context.md'), 'utf8')).toContain(
      '## Decisions',
    );
  });

  it('archives and unarchives branch', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'feature/test');
    const branchDir = getBranchDir(workspace, 'feature/test');
    writeFileSync(join(branchDir, 'context.md'), 'MY CUSTOM CONTENT');
    expect(archiveBranch(workspace, 'feature-test')).toBe(true);
    expect(existsSync(branchDir)).toBe(false);
    expect(listArchivedBranches(workspace)).toContain('feature-test');
    expect(createBranchContext(workspace, 'feature/test')).toBe('restored_from_archive');
    expect(readFileSync(join(branchDir, 'context.md'), 'utf8')).toBe('MY CUSTOM CONTENT');
  });

  it('restores created branch context from archive', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'feature/old');
    const branchDir = getBranchDir(workspace, 'feature/old');
    writeFileSync(join(branchDir, 'context.md'), 'ARCHIVED CONTENT');
    archiveBranch(workspace, 'feature-old');
    expect(createBranchContext(workspace, 'feature/old')).toBe('restored_from_archive');
    expect(readFileSync(join(branchDir, 'context.md'), 'utf8')).toBe('ARCHIVED CONTENT');
  });

  it('sync restores branch context from archive', () => {
    const workspace = createWorkspace();
    syncBranch(workspace, 'feature/archived');
    const branchDir = getBranchDir(workspace, 'feature/archived');
    writeFileSync(join(branchDir, 'context.md'), 'RESTORE ME');
    archiveBranch(workspace, 'feature-archived');
    expect(syncBranch(workspace, 'feature/archived').create_result).toBe('restored_from_archive');
    expect(readFileSync(join(branchDir, 'context.md'), 'utf8')).toBe('RESTORE ME');
  });

  it('deletes active and archived branch contexts', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'feature/active');
    createBranchContext(workspace, 'feature/archived');
    archiveBranch(workspace, 'feature-archived');

    expect(deleteBranchContext(workspace, 'feature-active')).toBe(true);
    expect(deleteBranchContext(workspace, 'feature-archived', true)).toBe(true);
    expect(branchContextExists(workspace, 'feature/active')).toBe(false);
    expect(listArchivedBranches(workspace)).not.toContain('feature-archived');
  });

  it('syncs current branch through service', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.branch).toBe('main');
    expect(result.branchKey).toBe('main');
    expect(result.createResult).toBe('created_from_template');
    expect(result.symlinkResult).toBe('updated');
    expect(result.baseBranch).toBe('main');
    expect(existsSync(join(repo, DEFAULT_SYMLINK))).toBe(true);
  });

  it('initializes project and creates current context from template', async () => {
    const repo = createGitRepo();
    const result = await initProject(repo);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.alreadyInitialized).toBe(false);
    expect(result.syncResult.ok).toBe(true);
    if (!result.syncResult.ok) {
      return;
    }
    expect(result.syncResult.createResult).toBe('created_from_template');
    expect(existsSync(join(repo, DEFAULT_SYMLINK, 'context.md'))).toBe(true);
  });

  it('falls back from missing origin main to local main default base', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expect(gitCheckout(repo, 'feature/base-fallback', true).status).toBe(0);
    writeFileSync(join(repo, 'base-fallback.txt'), 'changed');
    expect(gitAdd(repo).status).toBe(0);
    expect(gitCommit(repo, 'feat: base fallback').status).toBe(0);
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.baseBranch).toBe('main');
    expect(result.updates).toHaveLength(2);
    const content = readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8');
    expect(content).toContain('feat: base fallback');
    expect(content).toContain('base-fallback.txt');
  });

  it('reports missing config through sync service', () => {
    const repo = createGitRepo();
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe('not_initialized');
  });

  it('gets and sets current base through service', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncCurrentBranch(repo, { sound: false });
    const initial = getCurrentBase(repo);
    expect(initial.ok).toBe(true);
    if (!initial.ok) {
      return;
    }
    expect(initial.baseBranch).toBe('main');
    const updated = setCurrentBase(repo, 'develop');
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.branch).toBe('main');
    expect(updated.baseBranch).toBe('develop');
    const current = getCurrentBase(repo);
    expect(current.ok).toBe(true);
    if (!current.ok) {
      return;
    }
    expect(current.baseBranch).toBe('develop');
  });

  it('reports missing context through base service', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const result = getCurrentBase(repo);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe('missing_context');
    expect(result.branch).toBe('main');
  });
});
