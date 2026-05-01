import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  captureCodexSession,
  getAgentSessions,
  getClaudeProjectKey,
  readAgentsFile,
  syncAgentSessions,
} from '../src/index';
import { gitCheckout } from '../src/utils/git';
import { createGitRepo, createTempDir, expectOk, initBctxWorkspace } from './helpers';

const fixturesDir = join(__dirname, 'fixtures', 'agents');

function copyCodexFixture(root: string, repoRoot: string, fixture = 'codex-native.jsonl') {
  const dir = join(root, '2026', '05', '01');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, fixture),
    readFileSync(join(fixturesDir, fixture), 'utf8').replaceAll('/repo/project', repoRoot),
  );
}

function copyClaudeFixture(root: string, repoRoot: string) {
  const dir = join(root, getClaudeProjectKey(repoRoot));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'claude.jsonl'),
    readFileSync(join(fixturesDir, 'claude.jsonl'), 'utf8').replaceAll('/repo/project', repoRoot),
  );
}

describe('agent session service', () => {
  it('gets sessions without writing when repo is not initialized', () => {
    const repo = createGitRepo();
    const codexRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);

    const result = getAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessions.map((session) => session.sessionId)).toEqual(['codex-1']);
    expect(result.agentsFilePath).toBeNull();
  });

  it('syncs exact branch sessions into current agents file', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));

    const codexRoot = createTempDir();
    const claudeRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);
    copyClaudeFixture(claudeRoot, repo);

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      claudeProjectsRoot: claudeRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.written).toBe(true);
    expect(result.agentsFilePath).toBeTruthy();
    expect(existsSync(result.agentsFilePath ?? '')).toBe(true);
    expect(
      readAgentsFile(result.agentsFilePath ?? '')
        .sessions.map((session) => session.provider)
        .sort(),
    ).toEqual(['claude', 'codex']);
  });

  it('does not write repo-scoped fallback sessions', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    const codexRoot = createTempDir();
    copyCodexFixture(codexRoot, repo, 'codex-repo.jsonl');

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessions).toEqual([]);
    expect(readAgentsFile(result.agentsFilePath ?? '').sessions).toEqual([]);
  });

  it('captures Codex sessions safely outside git repos', () => {
    const dir = createTempDir();
    const result = captureCodexSession({ session_id: 'codex-1' }, { cwd: dir });

    expect(result.captured).toBe(false);
    expect(result.reason).toBe('no_git_repo');
  });

  it('injects metadata without writing when repo is not initialized', () => {
    const repo = createGitRepo();
    const result = captureCodexSession(
      {
        session_id: 'codex-1',
        transcript_path: '~/.codex/sessions/session.jsonl',
        model: 'gpt-5.5',
        source: 'cli',
      },
      { cwd: repo, now: new Date('2026-05-01T14:21:16.417Z') },
    );

    expect(result.captured).toBe(false);
    expect(result.reason).toBe('not_initialized');
    expect(result.metadata?.branch).toBe('main');
    expect(result.agentsFilePath).toBeNull();
  });

  it('captures Codex sessions into initialized current context', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);

    const result = captureCodexSession(
      {
        session_id: 'codex-1',
        transcript_path: '~/.codex/sessions/session.jsonl',
        model: 'gpt-5.5',
        source: 'cli',
      },
      { cwd: repo, now: new Date('2026-05-01T14:21:16.417Z') },
    );

    expect(result.captured).toBe(true);
    expect(result.agentsFilePath).toBeTruthy();
    const content = readFileSync(result.agentsFilePath ?? '', 'utf8');
    expect(content).toContain('codex-1');
  });
});
