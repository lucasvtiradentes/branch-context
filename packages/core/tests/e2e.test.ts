import { readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMLINK, getBranchRelPath, syncBranch } from '../src/index';
import { gitCheckout } from '../src/utils/git';
import { createGitRepo, expectOk, initBctxWorkspace } from './helpers';

function normalize(path: string) {
  return path.replaceAll('\\', '/');
}

describe('branch context e2e', () => {
  it('preserves content across branch switches', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const symlinkPath = join(repo, DEFAULT_SYMLINK);
    syncBranch(repo, 'main');
    writeFileSync(join(symlinkPath, 'context.md'), 'MAIN CONTENT');
    expectOk(gitCheckout(repo, 'feature', true));
    syncBranch(repo, 'feature');
    expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath('feature'));
    writeFileSync(join(symlinkPath, 'context.md'), 'FEATURE CONTENT');
    expectOk(gitCheckout(repo, 'main'));
    syncBranch(repo, 'main');
    expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe('MAIN CONTENT');
    expectOk(gitCheckout(repo, 'feature'));
    syncBranch(repo, 'feature');
    expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe('FEATURE CONTENT');
  });

  it('handles multiple branches e2e', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const symlinkPath = join(repo, DEFAULT_SYMLINK);
    const branches = ['main', 'dev', 'staging'];
    const contents = new Map<string, string>();
    for (const branch of branches) {
      expectOk(gitCheckout(repo, branch, branch !== 'main'));
      syncBranch(repo, branch);
      const content = `CONTENT FOR ${branch.toUpperCase()}`;
      contents.set(branch, content);
      writeFileSync(join(symlinkPath, 'context.md'), content);
    }
    for (const branch of branches) {
      expectOk(gitCheckout(repo, branch));
      syncBranch(repo, branch);
      expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe(contents.get(branch));
    }
  });

  it('handles slash branch names e2e', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const symlinkPath = join(repo, DEFAULT_SYMLINK);
    syncBranch(repo, 'main');
    writeFileSync(join(symlinkPath, 'context.md'), 'MAIN');
    expectOk(gitCheckout(repo, 'feature/auth/login', true));
    syncBranch(repo, 'feature/auth/login');
    expect(normalize(readlinkSync(symlinkPath))).toBe(getBranchRelPath('feature/auth/login'));
    writeFileSync(join(symlinkPath, 'context.md'), 'FEATURE AUTH LOGIN');
    expectOk(gitCheckout(repo, 'main'));
    syncBranch(repo, 'main');
    expect(readFileSync(join(symlinkPath, 'context.md'), 'utf8')).toBe('MAIN');
  });
});
