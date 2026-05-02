import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AgentSessionProvider,
  createAgentSession,
  createEmptyAgentsFile,
  getBranchAgentsFilePath,
  getBranchAgentsFilePathByKey,
  getCurrentAgentsFilePath,
  readAgentsFile,
  removeAgentSessionPin,
  syncBranch,
  upsertAgentSession,
  upsertAgentSessionPin,
  writeAgentsFile,
} from '../src/index';
import { createWorkspace } from './helpers';

function createSession(overrides: Partial<ReturnType<typeof createAgentSession>> = {}) {
  return createAgentSession({
    provider: AgentSessionProvider.Codex,
    sessionId: 'codex-1',
    branch: 'feature/test',
    path: '~/.codex/sessions/session.jsonl',
    model: 'gpt-5.5',
    title: 'First prompt',
    startedAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  });
}

describe('agents file', () => {
  it('creates empty agents file data', () => {
    expect(createEmptyAgentsFile()).toEqual({ version: 1, sessions: [] });
  });

  it('reads empty data when file is missing', () => {
    const workspace = createWorkspace();
    expect(readAgentsFile(join(workspace, 'missing.json'))).toEqual(createEmptyAgentsFile());
  });

  it('reads empty data for invalid json', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'agents.json');
    writeFileSync(path, '{invalid');
    expect(readAgentsFile(path)).toEqual(createEmptyAgentsFile());
  });

  it('writes agents file', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'nested', 'agents.json');
    writeAgentsFile(path, { version: 1, sessions: [createSession()] });
    expect(existsSync(path)).toBe(true);
    const sessions = JSON.parse(readFileSync(path, 'utf8')).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toHaveProperty('branch');
    expect(sessions[0]).not.toHaveProperty('scope');
  });

  it('reads legacy agents file with top-level pinned sessions', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'agents.json');
    writeFileSync(
      path,
      `${JSON.stringify({
        version: 1,
        sessions: [createSession()],
        pinnedSessions: [
          {
            provider: AgentSessionProvider.Codex,
            sessionId: 'codex-1',
            description: 'Pinned work',
            pinnedAt: '2026-05-01T10:00:00.000Z',
          },
        ],
      })}\n`,
    );

    expect(readAgentsFile(path).sessions[0]?.pinned).toEqual({
      description: 'Pinned work',
      pinnedAt: '2026-05-01T10:00:00.000Z',
    });
  });

  it('upserts sessions by provider and id', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'agents.json');

    upsertAgentSession(path, createSession({ title: 'Old' }));
    const updated = upsertAgentSession(path, createSession({ title: 'New', model: 'gpt-5.6' }));

    expect(updated.sessions).toHaveLength(1);
    expect(updated.sessions[0]?.title).toBe('New');
    expect(updated.sessions[0]?.model).toBe('gpt-5.6');
  });

  it('sorts newest sessions first', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'agents.json');

    upsertAgentSession(
      path,
      createSession({
        sessionId: 'old',
        startedAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      }),
    );
    const updated = upsertAgentSession(
      path,
      createSession({
        sessionId: 'new',
        startedAt: '2026-05-01T11:00:00.000Z',
        updatedAt: '2026-05-01T11:00:00.000Z',
      }),
    );

    expect(updated.sessions.map((session) => session.sessionId)).toEqual(['new', 'old']);
  });

  it('upserts and removes pinned sessions', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'agents.json');

    upsertAgentSession(path, createSession());
    upsertAgentSessionPin(path, {
      provider: AgentSessionProvider.Codex,
      sessionId: 'codex-1',
      description: 'Old label',
      pinnedAt: '2026-05-01T10:00:00.000Z',
    });
    const pinned = upsertAgentSessionPin(path, {
      provider: AgentSessionProvider.Codex,
      sessionId: 'codex-1',
      description: 'New label',
      pinnedAt: '2026-05-01T11:00:00.000Z',
    });

    expect(pinned.sessions[0]?.pinned).toEqual({
      description: 'New label',
      pinnedAt: '2026-05-01T11:00:00.000Z',
    });
    expect(
      removeAgentSessionPin(path, AgentSessionProvider.Codex, 'codex-1').sessions[0]?.pinned,
    ).toBeNull();
  });

  it('resolves current and branch-local paths', () => {
    const workspace = createWorkspace();
    mkdirSync(join(workspace, '.bctx', 'branches'), { recursive: true });
    syncBranch(workspace, 'feature/test');

    expect(getCurrentAgentsFilePath(workspace)).toBe(join(workspace, '_branch', 'agents.json'));
    expect(getBranchAgentsFilePath(workspace, 'feature/test')).toBe(
      join(workspace, '.bctx', 'branches', 'feature-test', 'agents.json'),
    );
    expect(getBranchAgentsFilePathByKey(workspace, 'feature-test')).toBe(
      join(workspace, '.bctx', 'branches', 'feature-test', 'agents.json'),
    );
  });

  it('defaults branch scope when omitted', () => {
    expect(createSession().scope).toBe('branch');
  });
});
