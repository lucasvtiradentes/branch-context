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
import { gitAdd, gitCheckout, gitCommit } from '../src/git';
import {
  archiveBranch,
  BranchContextActionErrorReason,
  branchContextExists,
  CONTEXT_FILE_NAME,
  Config,
  CreateBranchContextResult,
  createBranchContext,
  DEFAULT_SYMLINK,
  deleteBranchContext,
  getBranchDir,
  getBranchRelPath,
  getCurrentBase,
  initProject,
  listArchivedBranches,
  listBranches,
  ResetBranchContextResult,
  resetBranchContext,
  setCurrentBase,
  syncBranch,
  syncCurrentBranch,
  UpdateSymlinkResult,
  updateSymlink,
} from '../src/index';
import {
  createGitRepo,
  createWorkspace,
  createWorkspaceNoTemplate,
  expectOk,
  initBctxWorkspace,
} from './helpers';

function normalize(path: string) {
  return path.replaceAll('\\', '/');
}

describe('sync parity', () => {
  it('creates branch context from template', () => {
    const workspace = createWorkspace();
    expect(createBranchContext(workspace, 'main')).toBe(
      CreateBranchContextResult.CreatedFromTemplate,
    );
    expect(existsSync(getBranchDir(workspace, 'main'))).toBe(true);
    expect(existsSync(join(getBranchDir(workspace, 'main'), CONTEXT_FILE_NAME))).toBe(true);
  });

  it('returns exists for existing branch context', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    expect(createBranchContext(workspace, 'main')).toBe(CreateBranchContextResult.Exists);
  });

  it('repairs existing branch context missing context file', () => {
    const workspace = createWorkspace();
    const branchDir = getBranchDir(workspace, 'main');
    mkdirSync(branchDir, { recursive: true });
    expect(createBranchContext(workspace, 'main')).toBe(
      CreateBranchContextResult.RepairedFromTemplate,
    );
    expect(existsSync(join(branchDir, CONTEXT_FILE_NAME))).toBe(true);
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
    expect(updateSymlink(workspace, 'main')).toBe(UpdateSymlinkResult.Updated);
    expect(existsSync(join(workspace, DEFAULT_SYMLINK))).toBe(true);
  });

  it('returns unchanged for already current symlink', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    updateSymlink(workspace, 'main');
    expect(updateSymlink(workspace, 'main')).toBe(UpdateSymlinkResult.Unchanged);
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
    expect(createBranchContext(workspace, 'main')).toBe(CreateBranchContextResult.CreatedEmpty);
    expect(readdirSync(getBranchDir(workspace, 'main'))).toEqual(['.config']);
  });

  it('returns error when symlink path is regular file', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    writeFileSync(join(workspace, DEFAULT_SYMLINK), 'regular file');
    expect(updateSymlink(workspace, 'main')).toBe(UpdateSymlinkResult.ErrorNotSymlink);
  });

  it('syncs branch and returns result object', () => {
    const workspace = createWorkspace();
    const result = syncBranch(workspace, 'feature/test');
    expect(result.branch).toBe('feature/test');
    expect(result.branch_dir).toContain('feature-test');
    expect(result.create_result).toBe(CreateBranchContextResult.CreatedFromTemplate);
    expect(result.symlink_result).toBe(UpdateSymlinkResult.Updated);
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
    writeFileSync(join(symlinkPath, CONTEXT_FILE_NAME), 'MAIN CONTENT');
    syncBranch(workspace, 'feature');
    writeFileSync(join(symlinkPath, CONTEXT_FILE_NAME), 'FEATURE CONTENT');
    syncBranch(workspace, 'main');
    expect(readFileSync(join(symlinkPath, CONTEXT_FILE_NAME), 'utf8')).toBe('MAIN CONTENT');
    syncBranch(workspace, 'feature');
    expect(readFileSync(join(symlinkPath, CONTEXT_FILE_NAME), 'utf8')).toBe('FEATURE CONTENT');
  });

  it('handles multiple branch switches', () => {
    const workspace = createWorkspace();
    const symlinkPath = join(workspace, DEFAULT_SYMLINK);
    const branches = ['main', 'dev', 'feature/a', 'feature/b'];
    for (const branch of branches) {
      const result = syncBranch(workspace, branch);
      expect([UpdateSymlinkResult.Updated, UpdateSymlinkResult.Unchanged]).toContain(
        result.symlink_result,
      );
    }
    for (const branch of branches) {
      syncBranch(workspace, branch);
      expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath(branch));
    }
  });

  it('creates branch context from a matching branch prefix template', () => {
    const workspace = createWorkspace();
    expect(createBranchContext(workspace, 'fix/login')).toBe(
      CreateBranchContextResult.CreatedFromTemplate,
    );
    const content = readFileSync(
      join(getBranchDir(workspace, 'fix/login'), CONTEXT_FILE_NAME),
      'utf8',
    );
    expect(content).toContain('## Problem');
    expect(content).toContain('## Fix');
  });

  it('resets branch context', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    const branchDir = getBranchDir(workspace, 'main');
    writeFileSync(join(branchDir, CONTEXT_FILE_NAME), 'MODIFIED CONTENT');
    expect(resetBranchContext(workspace, 'main')).toBe(ResetBranchContextResult.Reset);
    const content = readFileSync(join(branchDir, CONTEXT_FILE_NAME), 'utf8');
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
    expect(resetBranchContext(workspace, 'main')).toBe(ResetBranchContextResult.Reset);
    expect(existsSync(join(branchDir, 'notes.md'))).toBe(true);
    expect(existsSync(join(branchDir, 'attachments', 'diagram.png'))).toBe(true);
  });

  it('resets branch context with specific template', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'main');
    expect(resetBranchContext(workspace, 'main', 'fix')).toBe(ResetBranchContextResult.Reset);
    expect(
      readFileSync(join(getBranchDir(workspace, 'main'), CONTEXT_FILE_NAME), 'utf8'),
    ).toContain('## Fix');
  });

  it('archives and unarchives branch', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'feature/test');
    const branchDir = getBranchDir(workspace, 'feature/test');
    writeFileSync(join(branchDir, CONTEXT_FILE_NAME), 'MY CUSTOM CONTENT');
    expect(archiveBranch(workspace, 'feature-test')).toBe(true);
    expect(existsSync(branchDir)).toBe(false);
    expect(listArchivedBranches(workspace)).toContain('feature-test');
    expect(createBranchContext(workspace, 'feature/test')).toBe(
      CreateBranchContextResult.RestoredFromArchive,
    );
    expect(readFileSync(join(branchDir, CONTEXT_FILE_NAME), 'utf8')).toBe('MY CUSTOM CONTENT');
  });

  it('restores created branch context from archive', () => {
    const workspace = createWorkspace();
    createBranchContext(workspace, 'feature/old');
    const branchDir = getBranchDir(workspace, 'feature/old');
    writeFileSync(join(branchDir, CONTEXT_FILE_NAME), 'ARCHIVED CONTENT');
    archiveBranch(workspace, 'feature-old');
    expect(createBranchContext(workspace, 'feature/old')).toBe(
      CreateBranchContextResult.RestoredFromArchive,
    );
    expect(readFileSync(join(branchDir, CONTEXT_FILE_NAME), 'utf8')).toBe('ARCHIVED CONTENT');
  });

  it('sync restores branch context from archive', () => {
    const workspace = createWorkspace();
    syncBranch(workspace, 'feature/archived');
    const branchDir = getBranchDir(workspace, 'feature/archived');
    writeFileSync(join(branchDir, CONTEXT_FILE_NAME), 'RESTORE ME');
    archiveBranch(workspace, 'feature-archived');
    expect(syncBranch(workspace, 'feature/archived').create_result).toBe(
      CreateBranchContextResult.RestoredFromArchive,
    );
    expect(readFileSync(join(branchDir, CONTEXT_FILE_NAME), 'utf8')).toBe('RESTORE ME');
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
    expectOk(gitCheckout(repo, 'origin/main', true));
    expectOk(gitCheckout(repo, 'main'));
    initBctxWorkspace(repo);
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.branch).toBe('main');
    expect(result.branchKey).toBe('main');
    expect(result.createResult).toBe(CreateBranchContextResult.CreatedFromTemplate);
    expect(result.symlinkResult).toBe(UpdateSymlinkResult.Updated);
    expect(result.baseBranch).toBe('origin/main');
    expect(existsSync(join(repo, DEFAULT_SYMLINK))).toBe(true);
  });

  it('initializes project and creates current context from template', async () => {
    const repo = createGitRepo();
    expectOk(gitCheckout(repo, 'origin/main', true));
    expectOk(gitCheckout(repo, 'main'));
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
    expect(result.syncResult.createResult).toBe(CreateBranchContextResult.CreatedFromTemplate);
    expect(existsSync(join(repo, DEFAULT_SYMLINK, CONTEXT_FILE_NAME))).toBe(true);
  });

  it('reports missing configured base through sync service', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    new Config({ defaultBaseBranch: 'origin/main', sound: false }).save(repo);
    expect(gitCheckout(repo, 'feature/missing-base', true).status).toBe(0);
    writeFileSync(join(repo, 'missing-base.txt'), 'changed');
    expect(gitAdd(repo).status).toBe(0);
    expect(gitCommit(repo, 'feat: missing base').status).toBe(0);
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe(BranchContextActionErrorReason.BaseBranchNotFound);
    expect(result.baseBranch).toBe('origin/main');
    expect(result.branch).toBe('feature/missing-base');
    expect(existsSync(join(repo, DEFAULT_SYMLINK, CONTEXT_FILE_NAME))).toBe(true);
  });

  it('reports missing config through sync service', () => {
    const repo = createGitRepo();
    const result = syncCurrentBranch(repo, { sound: false });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe(BranchContextActionErrorReason.NotInitialized);
  });

  it('does not sync detached head as a branch context', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'HEAD~0'));

    const result = syncCurrentBranch(repo, { sound: false });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe(BranchContextActionErrorReason.NoCurrentBranch);
    expect(existsSync(getBranchDir(repo, 'HEAD'))).toBe(false);
  });

  it('gets and sets current base through service', () => {
    const repo = createGitRepo();
    expectOk(gitCheckout(repo, 'origin/main', true));
    expectOk(gitCheckout(repo, 'main'));
    initBctxWorkspace(repo);
    syncCurrentBranch(repo, { sound: false });
    const initial = getCurrentBase(repo);
    expect(initial.ok).toBe(true);
    if (!initial.ok) {
      return;
    }
    expect(initial.baseBranch).toBe('origin/main');
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
    expect(result.reason).toBe(BranchContextActionErrorReason.MissingContext);
    expect(result.branch).toBe('main');
  });
});
