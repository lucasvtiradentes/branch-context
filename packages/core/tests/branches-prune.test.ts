import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cmdPrune, cmdStatus, collectBranchInfo, syncBranch } from '../src/index';
import { gitAdd, gitCheckout, gitCommit } from '../src/utils/git';
import { setMultiSelectOverride } from '../src/utils/prompt';
import {
  captureConsole,
  createGitRepo,
  createTempDir,
  expectOk,
  git,
  initBctxWorkspace,
} from './helpers';

describe('branches and prune commands', () => {
  it('status shows branches', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    syncBranch(repo, 'feature/test');
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('main');
    expect(capture.output).toContain('feature');
  });

  it('status shows current marker', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('* main');
  });

  it('status shows orphan warning', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/old', true));
    syncBranch(repo, 'feature/old');
    expectOk(gitCheckout(repo, 'main'));
    git(['branch', '-D', 'feature/old'], repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('orphan');
  });

  it('prune does nothing when no orphans', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    const capture = captureConsole();
    expect(await cmdPrune([])).toBe(0);
    expect(capture.output).toContain('Nothing to prune');
  });

  it('prune archives orphans', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/old', true));
    syncBranch(repo, 'feature/old');
    expectOk(gitCheckout(repo, 'main'));
    git(['branch', '-D', 'feature/old'], repo);
    setMultiSelectOverride(() => [0]);
    const capture = captureConsole();
    expect(await cmdPrune([])).toBe(0);
    expect(capture.output).toContain('Archiving');
    expect(capture.output).toContain('feature');
  });

  it('prune excludes branches with remote', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    syncBranch(repo, 'main');
    const bare = createTempDir();
    expectOk(git(['init', '--bare'], bare));
    expectOk(git(['remote', 'add', 'origin', bare], repo));
    git(['push', '-u', 'origin', 'main'], repo);
    expectOk(gitCheckout(repo, 'feature/synced', true));
    syncBranch(repo, 'feature/synced');
    writeFileSync(`${repo}/tmp.txt`, 'x');
    expectOk(gitAdd(repo, 'tmp.txt'));
    expectOk(gitCommit(repo, 'tmp'));
    git(['push', '-u', 'origin', 'feature/synced'], repo);
    expectOk(gitCheckout(repo, 'main'));
    expectOk(gitCheckout(repo, 'feature/local-only', true));
    syncBranch(repo, 'feature/local-only');
    expectOk(gitCheckout(repo, 'main'));
    setMultiSelectOverride(() => []);
    const capture = captureConsole();
    expect(await cmdPrune([])).toBe(0);
    expect(capture.output).toContain('feature/local-only');
    expect(capture.output.split('Select')[1]).not.toContain('feature/synced');
  });

  it('collects basic branch info', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    const info = collectBranchInfo(repo);
    expect(info.get('main')?.context).toBe(true);
    expect(info.get('main')?.local).toBe(true);
  });

  it('collects orphan branch info', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    syncBranch(repo, 'feature/test');
    expectOk(gitCheckout(repo, 'main'));
    git(['branch', '-D', 'feature/test'], repo);
    const orphans = Array.from(collectBranchInfo(repo).values()).filter(
      (info) => info.context && !info.local,
    );
    expect(orphans).toHaveLength(1);
  });
});
