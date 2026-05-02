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
  syncBranch,
  upsertAgentSession,
  writeAgentsFile,
} from '../src/index';
import { createWorkspace } from './helpers';

function createSession(overrides: Partial<ReturnType<typeof createAgentSession>> = {}) {
  return createAgentSession({
    provider: AgentSessionProvider.Codex,
    sessionId: 'codex-1',
    repoRoot: '/repo',
    branch: 'feature/test',
    branchKey: 'feature-test',
    path: '~/.codex/sessions/session.jsonl',
    model: 'gpt-5.5',
    source: 'cli',
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
    expect(JSON.parse(readFileSync(path, 'utf8')).sessions).toHaveLength(1);
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

  it('derives branch key when omitted', () => {
    expect(createSession({ branchKey: '', branch: 'feature/with spaces' }).branchKey).toBe(
      'feature-with-spaces',
    );
  });
});
