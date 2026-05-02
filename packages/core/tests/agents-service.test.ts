import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitCheckout } from '../src/git';
import {
  AgentSessionProvider,
  AgentSessionScope,
  createAgentSession,
  getAgentSessions,
  getCachedAgentSessions,
  getClaudeProjectKey,
  getCurrentAgentsFilePath,
  readAgentsFile,
  syncAgentSessions,
  writeAgentsFile,
} from '../src/index';
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
    ).toEqual([AgentSessionProvider.Claude, AgentSessionProvider.Codex]);
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

  it('preserves pinned sessions while syncing current agents file', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    const agentsFilePath = getCurrentAgentsFilePath(repo);
    writeAgentsFile(agentsFilePath, {
      version: 1,
      sessions: [
        {
          provider: AgentSessionProvider.Codex,
          sessionId: 'codex-1',
          path: null,
          model: null,
          title: null,
          startedAt: null,
          updatedAt: '2026-05-01T10:00:00.000Z',
          pinned: {
            description: 'Pinned work',
            pinnedAt: '2026-05-01T10:00:00.000Z',
          },
        },
      ],
    });
    const codexRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(readAgentsFile(agentsFilePath).sessions[0]?.pinned).toEqual({
      description: 'Pinned work',
      pinnedAt: '2026-05-01T10:00:00.000Z',
    });
  });

  it('gets cached agent sessions without scanning provider files', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    writeAgentsFile(getCurrentAgentsFilePath(repo), {
      version: 1,
      sessions: [
        createAgentSession({
          provider: AgentSessionProvider.Codex,
          sessionId: 'codex-current',
          branch: 'feature/test',
          path: null,
          model: null,
          title: null,
          startedAt: null,
          updatedAt: '2026-05-01T10:00:00.000Z',
        }),
        createAgentSession({
          provider: AgentSessionProvider.Claude,
          sessionId: 'claude-other',
          branch: 'feature/other',
          path: null,
          model: null,
          title: null,
          startedAt: null,
          updatedAt: '2026-05-01T11:00:00.000Z',
        }),
        createAgentSession({
          provider: AgentSessionProvider.Codex,
          sessionId: 'codex-repo',
          branch: '',
          scope: AgentSessionScope.Repo,
          path: null,
          model: null,
          title: null,
          startedAt: null,
          updatedAt: '2026-05-01T12:00:00.000Z',
        }),
      ],
    });

    const result = getCachedAgentSessions(repo, { branch: 'feature/test' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      'codex-repo',
      'claude-other',
      'codex-current',
    ]);
  });

  it('does not rewrite current agents file when synced sessions are unchanged', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    const codexRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);

    const firstResult = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });
    const secondResult = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) {
      return;
    }
    expect(firstResult.written).toBe(true);
    expect(secondResult.written).toBe(false);
  });

  it('syncs native Codex sessions into initialized current context', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    const codexRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.agentsFilePath).toBeTruthy();
    expect(readAgentsFile(result.agentsFilePath ?? '').sessions[0]?.sessionId).toBe('codex-1');
  });
});
