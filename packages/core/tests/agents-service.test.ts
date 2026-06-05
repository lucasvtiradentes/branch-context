import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitCheckout } from '../src/git';
import {
  AgentSessionProvider,
  AgentSessionScope,
  archiveBranch,
  createAgentSession,
  getAgentSessions,
  getBranchAgentsFilePath,
  getCachedAgentSessions,
  getClaudeProjectKey,
  getCurrentAgentsFilePath,
  moveAgentSessionToBranch,
  readAgentsFile,
  syncAgentSessions,
  syncAllAgentSessions,
  syncCurrentBranch,
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

function copyPiFixture(root: string, repoRoot: string, fixture = 'pi-branch.jsonl') {
  const dir = join(root, '--repo-project--');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, fixture),
    readFileSync(join(fixturesDir, fixture), 'utf8').replaceAll('/repo/project', repoRoot),
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
    const piRoot = createTempDir();
    copyCodexFixture(codexRoot, repo);
    copyClaudeFixture(claudeRoot, repo);
    copyPiFixture(piRoot, repo);

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      claudeProjectsRoot: claudeRoot,
      piSessionsRoot: piRoot,
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
    ).toEqual([AgentSessionProvider.Claude, AgentSessionProvider.Codex, AgentSessionProvider.Pi]);
  });

  it('does not write repo-scoped fallback sessions', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/test', true));
    const codexRoot = createTempDir();
    const piRoot = createTempDir();
    copyCodexFixture(codexRoot, repo, 'codex-repo.jsonl');
    copyPiFixture(piRoot, repo, 'pi-repo.jsonl');

    const result = syncAgentSessions(repo, {
      branch: 'feature/test',
      codexSessionsRoot: codexRoot,
      piSessionsRoot: piRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessions).toEqual([]);
    expect(readAgentsFile(result.agentsFilePath ?? '').sessions).toEqual([]);
  });

  it('preserves session metadata while syncing current agents file', () => {
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
    expect(readAgentsFile(agentsFilePath).sessions[0]).toMatchObject({
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

  it('syncs exact branch sessions into all branch contexts', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/one', true));
    syncCurrentBranch(repo, { sound: false });
    expectOk(gitCheckout(repo, 'feature/two', true));
    syncCurrentBranch(repo, { sound: false });
    expectOk(gitCheckout(repo, 'feature/old', true));
    syncCurrentBranch(repo, { sound: false });
    expect(archiveBranch(repo, 'feature-old')).toBe(true);

    const codexRoot = createTempDir();
    const dir = join(codexRoot, '2026', '05', '01');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'one.jsonl'),
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: 'codex-one',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: repo,
          source: 'cli',
          git: { branch: 'feature/one' },
        },
      }),
    );
    writeFileSync(
      join(dir, 'two.jsonl'),
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: 'codex-two',
          timestamp: '2026-05-01T11:00:00.000Z',
          cwd: repo,
          source: 'cli',
          git: { branch: 'feature/two' },
        },
      }),
    );
    writeFileSync(
      join(dir, 'old.jsonl'),
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: 'codex-old',
          timestamp: '2026-05-01T12:00:00.000Z',
          cwd: repo,
          source: 'cli',
          git: { branch: 'feature/old' },
        },
      }),
    );

    const result = syncAllAgentSessions(repo, {
      codexSessionsRoot: codexRoot,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessionCount).toBe(3);
    expect(
      readAgentsFile(getBranchAgentsFilePath(repo, 'feature/one')).sessions[0]?.sessionId,
    ).toBe('codex-one');
    expect(
      readAgentsFile(getBranchAgentsFilePath(repo, 'feature/two')).sessions[0]?.sessionId,
    ).toBe('codex-two');
    expect(
      result.branches.find((branch) => branch.branch === 'feature/old')?.sessions[0],
    ).toMatchObject({
      sessionId: 'codex-old',
    });
  });

  it('syncs Pi branch-context sessions into all branch contexts', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    expectOk(gitCheckout(repo, 'feature/one', true));
    syncCurrentBranch(repo, { sound: false });
    expectOk(gitCheckout(repo, 'feature/two', true));
    syncCurrentBranch(repo, { sound: false });

    const piRoot = createTempDir();
    const dir = join(piRoot, '--repo-project--');
    mkdirSync(dir, { recursive: true });
    for (const [sessionId, branch] of [
      ['pi-one', 'feature/one'],
      ['pi-two', 'feature/two'],
    ]) {
      writeFileSync(
        join(dir, `${sessionId}.jsonl`),
        [
          JSON.stringify({
            type: 'session',
            version: 3,
            id: sessionId,
            timestamp: '2026-05-01T10:00:00.000Z',
            cwd: repo,
          }),
          JSON.stringify({
            type: 'custom',
            customType: 'branch-context',
            data: { cwd: repo, repoRoot: repo, gitBranch: branch },
          }),
        ].join('\n'),
      );
    }

    const result = syncAllAgentSessions(repo, { piSessionsRoot: piRoot });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.sessionCount).toBe(2);
    expect(readAgentsFile(getBranchAgentsFilePath(repo, 'feature/one')).sessions[0]).toMatchObject({
      provider: AgentSessionProvider.Pi,
      sessionId: 'pi-one',
    });
    expect(readAgentsFile(getBranchAgentsFilePath(repo, 'feature/two')).sessions[0]).toMatchObject({
      provider: AgentSessionProvider.Pi,
      sessionId: 'pi-two',
    });
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

  it('moves a Codex session to another branch and patches jsonl metadata', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const sessionFile = join(createTempDir(), 'codex.jsonl');
    writeFileSync(
      sessionFile,
      [
        JSON.stringify({
          type: 'session_meta',
          payload: {
            id: 'codex-1',
            timestamp: '2026-05-01T10:00:00.000Z',
            cwd: repo,
            source: 'cli',
            git: { branch: 'feature/old' },
          },
        }),
        JSON.stringify({ type: 'turn_context', payload: { cwd: repo, model: 'gpt-5.5' } }),
      ].join('\n'),
    );
    writeAgentsFile(getBranchAgentsFilePath(repo, 'feature/old'), {
      version: 1,
      sessions: [
        {
          provider: AgentSessionProvider.Codex,
          sessionId: 'codex-1',
          path: sessionFile,
          model: 'gpt-5.5',
          title: null,
          startedAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          description: null,
          pinnedAt: null,
        },
      ],
    });

    const result = moveAgentSessionToBranch({
      repoRoot: repo,
      provider: AgentSessionProvider.Codex,
      sessionId: 'codex-1',
      fromBranch: 'feature/old',
      toBranch: 'feature/new',
    });

    expect(result.ok).toBe(true);
    expect(readAgentsFile(getBranchAgentsFilePath(repo, 'feature/old')).sessions).toEqual([]);
    expect(
      readAgentsFile(getBranchAgentsFilePath(repo, 'feature/new')).sessions[0]?.sessionId,
    ).toBe('codex-1');
    expect(readFileSync(sessionFile, 'utf8')).toContain('"branch":"feature/new"');
  });

  it('moves a Pi session to another branch and patches branch-context metadata', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const sessionFile = join(createTempDir(), 'pi.jsonl');
    writeFileSync(
      sessionFile,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'pi-1',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: repo,
        }),
        JSON.stringify({
          type: 'custom',
          id: 'bctx1',
          parentId: null,
          timestamp: '2026-05-01T10:00:00.100Z',
          customType: 'branch-context',
          data: { cwd: repo, repoRoot: repo, gitBranch: 'feature/old' },
        }),
      ].join('\n'),
    );
    writeAgentsFile(getBranchAgentsFilePath(repo, 'feature/old'), {
      version: 1,
      sessions: [
        {
          provider: AgentSessionProvider.Pi,
          sessionId: 'pi-1',
          path: sessionFile,
          model: null,
          title: null,
          startedAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          description: null,
          pinnedAt: null,
        },
      ],
    });

    const result = moveAgentSessionToBranch({
      repoRoot: repo,
      provider: AgentSessionProvider.Pi,
      sessionId: 'pi-1',
      fromBranch: 'feature/old',
      toBranch: 'feature/new',
    });

    expect(result.ok).toBe(true);
    expect(readAgentsFile(getBranchAgentsFilePath(repo, 'feature/old')).sessions).toEqual([]);
    expect(
      readAgentsFile(getBranchAgentsFilePath(repo, 'feature/new')).sessions[0]?.sessionId,
    ).toBe('pi-1');
    expect(readFileSync(sessionFile, 'utf8')).toContain('"gitBranch":"feature/new"');
  });

  it('does not move a Pi session without branch-context metadata', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const sessionFile = join(createTempDir(), 'pi.jsonl');
    writeFileSync(
      sessionFile,
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'pi-1',
        timestamp: '2026-05-01T10:00:00.000Z',
        cwd: repo,
      }),
    );
    writeAgentsFile(getBranchAgentsFilePath(repo, 'feature/old'), {
      version: 1,
      sessions: [
        {
          provider: AgentSessionProvider.Pi,
          sessionId: 'pi-1',
          path: sessionFile,
          model: null,
          title: null,
          startedAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          description: null,
          pinnedAt: null,
        },
      ],
    });

    const result = moveAgentSessionToBranch({
      repoRoot: repo,
      provider: AgentSessionProvider.Pi,
      sessionId: 'pi-1',
      fromBranch: 'feature/old',
      toBranch: 'feature/new',
    });

    expect(result).toMatchObject({ ok: false, reason: 'session_file_unpatchable' });
  });

  it('moves a Claude session to another branch and patches jsonl metadata', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const sessionFile = join(createTempDir(), 'claude.jsonl');
    writeFileSync(
      sessionFile,
      JSON.stringify({
        type: 'user',
        cwd: repo,
        sessionId: 'claude-1',
        timestamp: '2026-05-01T10:00:00.000Z',
        gitBranch: 'feature/old',
        message: { role: 'user', content: 'hello' },
      }),
    );
    writeAgentsFile(getBranchAgentsFilePath(repo, 'feature/old'), {
      version: 1,
      sessions: [
        {
          provider: AgentSessionProvider.Claude,
          sessionId: 'claude-1',
          path: sessionFile,
          model: null,
          title: 'hello',
          startedAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          description: null,
          pinnedAt: null,
        },
      ],
    });

    const result = moveAgentSessionToBranch({
      repoRoot: repo,
      provider: AgentSessionProvider.Claude,
      sessionId: 'claude-1',
      fromBranch: 'feature/old',
      toBranch: 'feature/new',
    });

    expect(result.ok).toBe(true);
    expect(readAgentsFile(getBranchAgentsFilePath(repo, 'feature/old')).sessions).toEqual([]);
    expect(
      readAgentsFile(getBranchAgentsFilePath(repo, 'feature/new')).sessions[0]?.sessionId,
    ).toBe('claude-1');
    expect(readFileSync(sessionFile, 'utf8')).toContain('"gitBranch":"feature/new"');
  });
});
