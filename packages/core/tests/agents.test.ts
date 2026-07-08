import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AgentSessionProvider,
  BRANCHES_DIR,
  CONFIG_DIR,
  createAgentSession,
  createEmptyAgentsFile,
  DEFAULT_SYMLINK,
  getBranchAgentsFilePath,
  getBranchAgentsFilePathByKey,
  getCurrentAgentsFilePath,
  readAgentsFile,
  SESSIONS_FILE_NAME,
  syncBranch,
  updateAgentSessionMetadata,
  upsertAgentSession,
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
    description: null,
    pinnedAt: null,
    ...overrides,
  });
}

describe('agents file', () => {
  it('creates empty agents file data', () => {
    expect(createEmptyAgentsFile()).toEqual([]);
  });

  it('reads empty data when file is missing', () => {
    const workspace = createWorkspace();
    expect(readAgentsFile(join(workspace, 'missing.json'))).toEqual(createEmptyAgentsFile());
  });

  it('reads empty data for invalid json', () => {
    const workspace = createWorkspace();
    const path = join(workspace, SESSIONS_FILE_NAME);
    writeFileSync(path, '{invalid');
    expect(readAgentsFile(path)).toEqual(createEmptyAgentsFile());
  });

  it('writes agents file', () => {
    const workspace = createWorkspace();
    const path = join(workspace, 'nested', SESSIONS_FILE_NAME);
    writeAgentsFile(path, [createSession()]);
    expect(existsSync(path)).toBe(true);
    const sessions = JSON.parse(readFileSync(path, 'utf8'));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toHaveProperty('branch');
    expect(sessions[0]).not.toHaveProperty('scope');
  });

  it('keeps Pi sessions when normalizing agents files', () => {
    const workspace = createWorkspace();
    const path = join(workspace, SESSIONS_FILE_NAME);

    writeAgentsFile(path, [
      createSession({ provider: AgentSessionProvider.Pi, sessionId: 'pi-1' }),
    ]);

    expect(readAgentsFile(path)[0]?.provider).toBe(AgentSessionProvider.Pi);
  });

  it('upserts sessions by provider and id', () => {
    const workspace = createWorkspace();
    const path = join(workspace, SESSIONS_FILE_NAME);

    upsertAgentSession(path, createSession({ title: 'Old' }));
    const updated = upsertAgentSession(path, createSession({ title: 'New', model: 'gpt-5.6' }));

    expect(updated).toHaveLength(1);
    expect(updated[0]?.title).toBe('New');
    expect(updated[0]?.model).toBe('gpt-5.6');
  });

  it('sorts newest sessions first', () => {
    const workspace = createWorkspace();
    const path = join(workspace, SESSIONS_FILE_NAME);

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

    expect(updated.map((session) => session.sessionId)).toEqual(['new', 'old']);
  });

  it('updates session metadata', () => {
    const workspace = createWorkspace();
    const path = join(workspace, SESSIONS_FILE_NAME);

    upsertAgentSession(path, createSession());
    const updated = updateAgentSessionMetadata(path, AgentSessionProvider.Codex, 'codex-1', {
      description: 'New label',
      pinnedAt: '2026-05-01T11:00:00.000Z',
    });

    expect(updated[0]).toMatchObject({
      description: 'New label',
      pinnedAt: '2026-05-01T11:00:00.000Z',
    });
  });

  it('resolves current and branch-local paths', () => {
    const workspace = createWorkspace();
    mkdirSync(join(workspace, CONFIG_DIR, BRANCHES_DIR), { recursive: true });
    syncBranch(workspace, 'feature/test');

    expect(getCurrentAgentsFilePath(workspace)).toBe(
      join(workspace, DEFAULT_SYMLINK, '.config', SESSIONS_FILE_NAME),
    );
    expect(getBranchAgentsFilePath(workspace, 'feature/test')).toBe(
      join(workspace, CONFIG_DIR, BRANCHES_DIR, 'feature-test', '.config', SESSIONS_FILE_NAME),
    );
    expect(getBranchAgentsFilePathByKey(workspace, 'feature-test')).toBe(
      join(workspace, CONFIG_DIR, BRANCHES_DIR, 'feature-test', '.config', SESSIONS_FILE_NAME),
    );
  });

  it('defaults branch scope when omitted', () => {
    expect(createSession().scope).toBe('branch');
  });
});
