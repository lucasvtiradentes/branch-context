import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENTS_FILE_NAME,
  archiveBranch,
  CONFIG_FILE,
  CONTEXT_FILE_NAME,
  CodexSessionEventType,
  DEFAULT_SYMLINK,
  getBranchMeta,
  getConfigDir,
  gitAdd,
  gitCheckout,
  gitCommit,
  loadArchivedMeta,
  readAgentsFile,
  sanitizeBranchName,
  syncBranch,
} from '@branch-context/core';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/index';
import { createGitRepo, createTempDir, expectOk, initBctxWorkspace } from './helpers';

function initMetaRepo() {
  const repo = createGitRepo();
  initBctxWorkspace(repo);
  mkdirSync(getConfigDir(repo), { recursive: true });
  writeFileSync(
    join(getConfigDir(repo), CONFIG_FILE),
    JSON.stringify({ default_base_branch: 'main', sound: false, template_rules: [] }),
  );
  process.chdir(repo);
  return repo;
}

describe('meta e2e', () => {
  it('on-checkout creates and updates meta', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    await runCli(['on-checkout', 'main', 'feature/test']);
    const meta = getBranchMeta(repo, sanitizeBranchName('feature/test'));
    expect(meta?.branch).toBe('feature/test');
    expect(meta?.author).toBe('Test User');
  });

  it('on-commit updates meta', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/commit-test', true));
    await runCli(['on-checkout', 'main', 'feature/commit-test']);
    writeFileSync(join(repo, 'new_file.py'), "print('hello')");
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add file'));
    await runCli(['on-commit']);
    const meta = getBranchMeta(repo, sanitizeBranchName('feature/commit-test'));
    expect(meta?.last_commit?.message).toBe('feat: add file');
    expect(meta?.commits).toContain('feat: add file');
  });

  it('on-commit updates context tags', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/tags-test', true));
    syncBranch(repo, 'feature/tags-test');
    await runCli(['on-checkout', 'main', 'feature/tags-test']);
    writeFileSync(join(repo, 'test.py'), "print('test')");
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: test commit'));
    await runCli(['on-commit']);
    const content = readFileSync(join(repo, DEFAULT_SYMLINK, CONTEXT_FILE_NAME), 'utf8');
    expect(content).toContain('feat: test commit');
    expect(content).toContain('test.py');
  });

  it('on-commit syncs agent sessions', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/test', true));
    syncBranch(repo, 'feature/test');
    await runCli(['on-checkout', 'main', 'feature/test']);

    const homeDir = initCodexHome(repo);
    const originalHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      await runCli(['on-commit']);
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
    }

    const sessions = readAgentsFile(join(repo, DEFAULT_SYMLINK, AGENTS_FILE_NAME)).sessions;
    expect(sessions.map((session) => session.sessionId)).toEqual(['codex-1']);
  });

  it('template preserves meta data', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/template-test', true));
    syncBranch(repo, 'feature/template-test');
    await runCli(['on-checkout', 'main', 'feature/template-test']);
    writeFileSync(join(repo, 'file.py'), 'x = 1');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: add file'));
    await runCli(['on-commit']);
    const branchKey = sanitizeBranchName('feature/template-test');
    const metaBefore = getBranchMeta(repo, branchKey);
    await runCli(['template', 'apply', '_default']);
    const metaAfter = getBranchMeta(repo, branchKey);
    expect(metaAfter?.commits).toBe(metaBefore?.commits);
    expect(metaAfter?.changed_files).toBe(metaBefore?.changed_files);
    expect(readFileSync(join(repo, DEFAULT_SYMLINK, CONTEXT_FILE_NAME), 'utf8')).toContain(
      'feat: add file',
    );
  });

  it('prune moves meta to archived', async () => {
    const repo = initMetaRepo();
    syncBranch(repo, 'main');
    expectOk(gitCheckout(repo, 'feature/to-prune', true));
    syncBranch(repo, 'feature/to-prune');
    await runCli(['on-checkout', 'main', 'feature/to-prune']);
    const branchKey = sanitizeBranchName('feature/to-prune');
    expect(getBranchMeta(repo, branchKey)).not.toBeNull();
    archiveBranch(repo, branchKey);
    expect(getBranchMeta(repo, branchKey)).toBeNull();
    expect(loadArchivedMeta(repo)[branchKey]?.branch).toBe('feature/to-prune');
  });
});

function initCodexHome(repo: string) {
  const homeDir = createTempDir();
  const now = new Date();
  const sessionDir = join(
    homeDir,
    '.codex',
    'sessions',
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  );
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, 'codex.jsonl'),
    [
      JSON.stringify({
        type: CodexSessionEventType.SessionMeta,
        payload: {
          id: 'codex-1',
          timestamp: now.toISOString(),
          cwd: repo,
          source: 'cli',
          git: { branch: 'feature/test' },
        },
      }),
      JSON.stringify({
        type: CodexSessionEventType.TurnContext,
        payload: { cwd: repo, model: 'gpt-5.5' },
      }),
    ].join('\n'),
  );
  return homeDir;
}
