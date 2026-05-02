import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitCheckout } from '../src/git';
import {
  AgentSessionProvider,
  getAgentSessions,
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
      sessions: [],
      pinnedSessions: [
        {
          provider: AgentSessionProvider.Codex,
          sessionId: 'codex-1',
          description: 'Pinned work',
          pinnedAt: '2026-05-01T10:00:00.000Z',
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
    expect(readAgentsFile(agentsFilePath).pinnedSessions).toHaveLength(1);
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
