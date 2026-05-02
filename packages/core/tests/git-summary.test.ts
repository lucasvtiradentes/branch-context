import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BranchGitSummaryErrorReason,
  GitFileStatus,
  getGitBranchSummary,
  gitChangedFileSummaries,
  gitCommitSummaries,
} from '../src/index';
import { gitAdd, gitCheckout, gitCommit } from '../src/utils/git';
import { createGitRepo, expectOk, initBctxWorkspace } from './helpers';

describe('git branch summary', () => {
  it('returns commits and changed files ahead of base', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'chore: init bctx'));
    expectOk(gitCheckout(repo, 'feature/summary', true));
    writeFileSync(join(repo, 'feature.ts'), 'export const value = 1;\n');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add summary file'));

    const summary = getGitBranchSummary(repo, 'main');

    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.commits[0]?.subject).toBe('feat: add summary file');
      expect(summary.changedFiles[0]).toMatchObject({
        status: GitFileStatus.Added,
        path: 'feature.ts',
        additions: 1,
        deletions: 0,
      });
    }
  });

  it('returns base errors without throwing', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);

    expect(getGitBranchSummary(repo, null)).toMatchObject({
      ok: false,
      reason: BranchGitSummaryErrorReason.MissingBase,
    });
    expect(getGitBranchSummary(repo, 'origin/main')).toMatchObject({
      ok: false,
      reason: BranchGitSummaryErrorReason.BaseNotFound,
      baseBranch: 'origin/main',
    });
  });

  it('parses renamed files', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    writeFileSync(join(repo, 'old.ts'), 'export const oldValue = 1;\n');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add old file'));
    expectOk(gitCheckout(repo, 'feature/rename', true));
    renameSync(join(repo, 'old.ts'), join(repo, 'new.ts'));
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'refactor: rename file'));

    expect(gitChangedFileSummaries(repo, 'main')[0]).toMatchObject({
      status: GitFileStatus.Renamed,
      path: 'new.ts',
      oldPath: 'old.ts',
    });
  });

  it('parses modified and deleted files', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    writeFileSync(join(repo, 'changed.ts'), 'export const value = 1;\n');
    writeFileSync(join(repo, 'removed.ts'), 'export const removed = true;\n');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add files'));
    expectOk(gitCheckout(repo, 'feature/change-files', true));
    writeFileSync(join(repo, 'changed.ts'), 'export const value = 2;\n');
    rmSync(join(repo, 'removed.ts'));
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'refactor: change files'));

    const summaries = gitChangedFileSummaries(repo, 'main');

    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: GitFileStatus.Modified,
          path: 'changed.ts',
        }),
        expect.objectContaining({
          status: GitFileStatus.Deleted,
          path: 'removed.ts',
        }),
      ]),
    );
  });

  it('parses commit summaries', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/commits', true));
    writeFileSync(join(repo, 'one.ts'), 'export const one = 1;\n');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: first'));
    writeFileSync(join(repo, 'two.ts'), 'export const two = 2;\n');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: second'));

    const commits = gitCommitSummaries(repo, 'main', 1);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.subject).toBe('feat: second');
    expect(commits[0]?.shortHash).toHaveLength(7);
    expect(commits[0]?.hash.length).toBeGreaterThan(7);
  });
});
