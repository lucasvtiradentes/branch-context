import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AgentMessageRole,
  AgentSessionProvider,
  AgentSessionScope,
  CodexPayloadType,
  CodexSessionEventType,
} from '../src/index';
import {
  getClaudeProjectKey,
  parseClaudeSessionFile,
  parseCodexSessionFile,
  scanAgentSessions,
  scanClaudeSessions,
  scanCodexSessions,
} from '../src/use-cases/agents';
import { createTempDir } from './helpers';

const fixturesDir = join(__dirname, 'fixtures', 'agents');

describe('agent provider parsers', () => {
  it('parses Claude sessions', () => {
    const session = parseClaudeSessionFile(join(fixturesDir, 'claude.jsonl'));

    expect(session.sessionId).toBe('claude-1');
    expect(session.cwd).toBe('/repo/project');
    expect(session.branch).toBe('feature/test');
    expect(session.model).toBe('claude-opus-4-7');
    expect(session.title).toBe('Claude title');
  });

  it('parses Codex native branch sessions', () => {
    const session = parseCodexSessionFile(join(fixturesDir, 'codex-native.jsonl'));

    expect(session.sessionId).toBe('codex-1');
    expect(session.cwd).toBe('/repo/project');
    expect(session.branch).toBe('feature/test');
    expect(session.model).toBe('gpt-5.5');
    expect(session.source).toBe('cli');
    expect(session.title).toBe('testando codex');
  });

  it('prefers Codex event messages over injected response items', () => {
    const session = parseCodexSessionFile(join(fixturesDir, 'codex-injected.jsonl'));

    expect(session.title).toBe('real prompt');
  });

  it('ignores Codex injected response items before the first prompt', () => {
    const root = createTempDir();
    const sessionPath = join(root, 'codex.jsonl');
    writeFileSync(
      sessionPath,
      [
        JSON.stringify({
          type: CodexSessionEventType.SessionMeta,
          payload: {
            id: 'codex-5',
            timestamp: '2026-05-01T14:24:16.417Z',
            cwd: '/repo/project',
            source: 'cli',
            git: { branch: 'feature/test' },
          },
        }),
        JSON.stringify({
          type: CodexSessionEventType.ResponseItem,
          payload: {
            type: 'message',
            role: AgentMessageRole.User,
            content: [{ type: 'input_text', text: '# AGENTS.md instructions for /repo/project' }],
          },
        }),
      ].join('\n'),
    );

    const session = parseCodexSessionFile(sessionPath);

    expect(session.title).toBeNull();
  });

  it('scans Claude sessions from the repo-specific directory', () => {
    const root = createTempDir();
    const repoRoot = '/repo/project';
    const projectDir = join(root, getClaudeProjectKey(repoRoot));
    mkdirSync(projectDir, { recursive: true });
    cpSync(join(fixturesDir, 'claude.jsonl'), join(projectDir, 'claude.jsonl'));

    const sessions = scanClaudeSessions({
      repoRoot,
      branch: 'feature/test',
      claudeProjectsRoot: root,
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['claude-1']);
    expect(sessions[0]?.scope).toBe(AgentSessionScope.Branch);
  });

  it('scans Codex sessions from historical date buckets', () => {
    const root = createTempDir();
    const todayDir = join(root, '2026', '05', '01');
    const oldDir = join(root, '2026', '04', '10');
    mkdirSync(todayDir, { recursive: true });
    mkdirSync(oldDir, { recursive: true });
    cpSync(join(fixturesDir, 'codex-native.jsonl'), join(todayDir, 'codex-native.jsonl'));
    cpSync(join(fixturesDir, 'codex-repo.jsonl'), join(todayDir, 'codex-repo.jsonl'));
    writeFileSync(
      join(oldDir, 'codex-old.jsonl'),
      [
        JSON.stringify({
          type: CodexSessionEventType.SessionMeta,
          payload: {
            id: 'codex-old',
            timestamp: '2026-04-10T14:21:16.417Z',
            cwd: '/repo/project',
            source: 'cli',
            git: { branch: 'feature/test' },
          },
        }),
        JSON.stringify({
          type: CodexSessionEventType.EventMessage,
          payload: { type: CodexPayloadType.UserMessage, message: 'old codex prompt' },
        }),
      ].join('\n'),
    );

    const sessions = scanCodexSessions({
      repoRoot: '/repo/project',
      branch: 'feature/test',
      codexSessionsRoot: root,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(sessions.map((session) => [session.sessionId, session.scope]).sort()).toEqual([
      ['codex-1', AgentSessionScope.Branch],
      ['codex-3', AgentSessionScope.Repo],
      ['codex-old', AgentSessionScope.Branch],
    ]);
  });

  it('scans all providers', () => {
    const root = createTempDir();
    const repoRoot = '/repo/project';
    const claudeDir = join(root, 'claude', getClaudeProjectKey(repoRoot));
    const codexDir = join(root, 'codex', '2026', '05', '01');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(codexDir, { recursive: true });
    cpSync(join(fixturesDir, 'claude.jsonl'), join(claudeDir, 'claude.jsonl'));
    cpSync(join(fixturesDir, 'codex-native.jsonl'), join(codexDir, 'codex-native.jsonl'));

    const sessions = scanAgentSessions({
      repoRoot,
      branch: 'feature/test',
      claudeProjectsRoot: dirname(claudeDir),
      codexSessionsRoot: join(root, 'codex'),
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(sessions.map((session) => session.provider).sort()).toEqual([
      AgentSessionProvider.Claude,
      AgentSessionProvider.Codex,
    ]);
  });
});
