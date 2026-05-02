import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitAdd, gitCheckout, gitCommit } from '../src/git';
import {
  createBranchMeta,
  DEFAULT_SYMLINK,
  sanitizeBranchName,
  syncBranch,
  updateBranchMeta,
  updateContextTags,
} from '../src/index';
import { createGitRepo, expectOk, initBctxWorkspace } from './helpers';

describe('context tags e2e', () => {
  it('updates tags on feature branch', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    syncBranch(repo, 'feature/test');
    const branchKey = sanitizeBranchName('feature/test');
    createBranchMeta(repo, branchKey, 'feature/test');
    writeFileSync(join(repo, 'new_file.py'), "print('hello')");
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add new file'));
    updateBranchMeta(repo, branchKey, 'main');
    const updates = updateContextTags(repo, join(repo, DEFAULT_SYMLINK), branchKey, 'main');
    expect(updates).toHaveLength(2);
    const content = readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8');
    expect(content).toContain('feat: add new file');
    expect(content).toContain('new_file.py');
  });

  it('shows sync message on main', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    const branchKey = sanitizeBranchName('main');
    createBranchMeta(repo, branchKey, 'main');
    updateBranchMeta(repo, branchKey, 'main');
    const updates = updateContextTags(repo, join(repo, DEFAULT_SYMLINK), branchKey, 'main');
    expect(updates).toHaveLength(2);
    expect(readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8')).toContain(
      'N/A - in sync with main',
    );
  });

  it('updates tags with multiple commits', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/multi', true));
    syncBranch(repo, 'feature/multi');
    const branchKey = sanitizeBranchName('feature/multi');
    createBranchMeta(repo, branchKey, 'feature/multi');
    for (let i = 0; i < 3; i += 1) {
      writeFileSync(join(repo, `file${i}.py`), `# file ${i}`);
      expectOk(gitAdd(repo));
      expectOk(gitCommit(repo, `feat: add file ${i}`));
    }
    updateBranchMeta(repo, branchKey, 'main');
    updateContextTags(repo, join(repo, DEFAULT_SYMLINK), branchKey, 'main');
    const content = readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8');
    expect(content).toContain('feat: add file 0');
    expect(content).toContain('feat: add file 1');
    expect(content).toContain('feat: add file 2');
  });

  it('updates tags with stats', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/stats', true));
    syncBranch(repo, 'feature/stats');
    const branchKey = sanitizeBranchName('feature/stats');
    createBranchMeta(repo, branchKey, 'feature/stats');
    writeFileSync(join(repo, 'test.py'), "print('test')");
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: test'));
    updateBranchMeta(repo, branchKey, 'main');
    updateContextTags(repo, join(repo, DEFAULT_SYMLINK), branchKey, 'main');
    const content = readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8');
    expect(content).toContain('test.py');
    expect(content).toContain('(+');
    expect(content).toContain('-');
  });

  it('skips files without tags silently', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    const branchKey = sanitizeBranchName('main');
    createBranchMeta(repo, branchKey, 'main');
    writeFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), '# No tags here');
    expect(updateContextTags(repo, join(repo, DEFAULT_SYMLINK), branchKey, 'main')).toHaveLength(0);
  });
});
