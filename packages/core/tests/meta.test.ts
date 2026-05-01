import { spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  archiveBranchMeta,
  createBranchMeta,
  deleteBranchMeta,
  getBranchMeta,
  getChangedFiles,
  getCommitsSinceBase,
  loadArchivedMeta,
  loadBranchMeta,
  sanitizeBranchName,
  syncBranch,
  updateBranchMeta,
} from '../src/index';
import { gitAdd, gitCheckout, gitCommit } from '../src/utils/git';
import { createGitRepo, expectOk, initBctxWorkspace } from './helpers';

describe('meta', () => {
  it('creates branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    createBranchMeta(repo, 'feature-test', 'feature/test');
    const meta = getBranchMeta(repo, 'feature-test');
    expect(meta?.branch).toBe('feature/test');
    expect(meta?.author).toBe('Test User');
    expect(meta?.created_at).toBeTruthy();
    expect(meta?.updated_at).toBeTruthy();
  });

  it('does not overwrite branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    createBranchMeta(repo, 'feature-test', 'feature/test');
    const originalCreated = getBranchMeta(repo, 'feature-test')?.created_at;
    createBranchMeta(repo, 'feature-test', 'feature/test');
    expect(getBranchMeta(repo, 'feature-test')?.created_at).toBe(originalCreated);
  });

  it('updates branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    const branchKey = sanitizeBranchName('feature/test');
    createBranchMeta(repo, branchKey, 'feature/test');
    writeFileSync(join(repo, 'new_file.py'), "print('hello')");
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add new file'));
    updateBranchMeta(repo, branchKey, 'main');
    const meta = getBranchMeta(repo, branchKey);
    expect(meta?.last_commit?.message).toBe('feat: add new file');
    expect(meta?.commits).toContain('feat: add new file');
    expect(meta?.changed_files).toContain('new_file.py');
  });

  it('reports missing base ref for commits and files', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expect(getCommitsSinceBase(repo, 'origin/main')).toBe('Base branch not found: origin/main');
    expect(getChangedFiles(repo, 'origin/main')).toBe('Base branch not found: origin/main');
  });

  it('archives branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    createBranchMeta(repo, 'feature-old', 'feature/old');
    archiveBranchMeta(repo, 'feature-old');
    expect(getBranchMeta(repo, 'feature-old')).toBeNull();
    expect(loadArchivedMeta(repo)['feature-old']?.branch).toBe('feature/old');
  });

  it('deletes branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    createBranchMeta(repo, 'feature-temp', 'feature/temp');
    expect(getBranchMeta(repo, 'feature-temp')).not.toBeNull();
    deleteBranchMeta(repo, 'feature-temp');
    expect(getBranchMeta(repo, 'feature-temp')).toBeNull();
  });

  it('loads empty branch meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expect(loadBranchMeta(repo)).toEqual({});
  });

  it('stores multiple branches in meta', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    createBranchMeta(repo, 'main', 'main');
    createBranchMeta(repo, 'feature-a', 'feature/a');
    createBranchMeta(repo, 'feature-b', 'feature/b');
    expect(Object.keys(loadBranchMeta(repo)).sort()).toEqual(['feature-a', 'feature-b', 'main']);
  });

  it('aligns changed file stats', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    writeFileSync(join(repo, 'short.py'), 'x = 1');
    writeFileSync(join(repo, 'very_long_filename_here.py'), 'y = 2');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'add files'));
    const positions = getChangedFiles(repo, 'main')
      .trim()
      .split('\n')
      .map((line) => line.indexOf('('));
    expect(new Set(positions).size).toBe(1);
  });

  it('formats pure rename', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    writeFileSync(join(repo, 'original.py'), 'content');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'add original to main'));
    expectOk(gitCheckout(repo, 'feature/rename', true));
    renameSync(join(repo, 'original.py'), join(repo, 'renamed.py'));
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'rename file'));
    expect(getChangedFiles(repo, 'main')).toContain('R  renamed.py  <-  original.py');
  });

  it('shows delete and add for modified rename', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    writeFileSync(join(repo, 'original.py'), 'original content here');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'add original to main'));
    expectOk(gitCheckout(repo, 'feature/modified-rename', true));
    renameSync(join(repo, 'original.py'), join(repo, 'renamed.py'));
    writeFileSync(join(repo, 'renamed.py'), 'completely different content');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'rename and modify'));
    const result = getChangedFiles(repo, 'main');
    expect(result).toContain('D  original.py');
    expect(result).toContain('A  renamed.py');
    expect(result).not.toContain('<-');
  });

  it('aligns renamed file stats', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    writeFileSync(join(repo, 'old_name.py'), 'content');
    writeFileSync(join(repo, 'another.py'), 'other');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'add files to main'));
    expectOk(gitCheckout(repo, 'feature/rename-align', true));
    renameSync(join(repo, 'old_name.py'), join(repo, 'new_name.py'));
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'rename'));
    const positions = getChangedFiles(repo, 'main')
      .trim()
      .split('\n')
      .map((line) => line.indexOf('('));
    expect(new Set(positions).size).toBe(1);
  });

  it('includes commit body when requested', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/desc-test', true));
    writeFileSync(join(repo, 'file.py'), 'x = 1');
    expectOk(gitAdd(repo));
    expectOk(
      spawnSync('git', ['commit', '-m', 'feat: add file', '-m', 'This is the body'], {
        cwd: repo,
        encoding: 'utf8',
      }),
    );
    const lines = getCommitsSinceBase(repo, 'main', true).trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('feat: add file');
    expect(lines[0]).toContain('- This is the body');
  });

  it('omits body separator when commit has no body', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/desc-nobody', true));
    writeFileSync(join(repo, 'file.py'), 'x = 1');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: no body commit'));
    const lines = getCommitsSinceBase(repo, 'main', true).trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('feat: no body commit');
    expect(lines[0]).not.toContain(' - ');
  });

  it('normalizes multiline commit body', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/desc-multi', true));
    writeFileSync(join(repo, 'file.py'), 'x = 1');
    expectOk(gitAdd(repo));
    expectOk(
      spawnSync('git', ['commit', '-m', 'feat: multi', '-m', 'Line one\nLine two\nLine three'], {
        cwd: repo,
        encoding: 'utf8',
      }),
    );
    const lines = getCommitsSinceBase(repo, 'main', true).trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('feat: multi');
    expect(lines[0]).toContain('Line one Line two Line three');
  });
});
