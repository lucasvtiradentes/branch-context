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
  parsePiSessionFile,
  scanAgentSessions,
  scanClaudeSessions,
  scanCodexSessions,
  scanPiSessions,
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

  it('parses Pi branch sessions', () => {
    const session = parsePiSessionFile(join(fixturesDir, 'pi-branch.jsonl'));

    expect(session.sessionId).toBe('pi-1');
    expect(session.cwd).toBe('/repo/project');
    expect(session.branch).toBe('feature/test');
    expect(session.repoRoot).toBe('/repo/project');
    expect(session.model).toBe('gpt-5.5');
    expect(session.title).toBe('testando pi');
  });

  it('uses the latest Pi branch metadata entry', () => {
    const root = createTempDir();
    const sessionPath = join(root, 'pi.jsonl');
    writeFileSync(
      sessionPath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'pi-latest-branch',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/repo/project',
        }),
        JSON.stringify({
          type: 'custom',
          customType: 'branch',
          data: { repoRoot: '/repo/project', gitBranch: 'feature/old' },
        }),
        JSON.stringify({
          type: 'custom',
          customType: 'branch',
          data: { repoRoot: '/repo/project', gitBranch: 'feature/new' },
        }),
      ].join('\n'),
    );

    expect(parsePiSessionFile(sessionPath).branch).toBe('feature/new');
  });

  it('ignores Pi custom_message entries when reading branch metadata', () => {
    const root = createTempDir();
    const sessionPath = join(root, 'pi.jsonl');
    writeFileSync(
      sessionPath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'pi-custom-message',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/repo/project',
        }),
        JSON.stringify({
          type: 'custom_message',
          customType: 'branch',
          content: JSON.stringify({ gitBranch: 'feature/wrong' }),
        }),
      ].join('\n'),
    );

    expect(parsePiSessionFile(sessionPath).branch).toBeNull();
  });

  it('uses Pi repoRoot metadata to match sessions started in subdirectories', () => {
    const root = createTempDir();
    const projectDir = join(root, '--repo-project-subdir--');
    mkdirSync(projectDir, { recursive: true });
    const sessionPath = join(projectDir, 'pi-subdir.jsonl');
    writeFileSync(
      sessionPath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'pi-subdir',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/repo/project/subdir',
        }),
        JSON.stringify({
          type: 'custom',
          customType: 'branch',
          data: { repoRoot: '/repo/project', gitBranch: 'feature/test' },
        }),
      ].join('\n'),
    );

    const sessions = scanPiSessions({
      repoRoot: '/repo/project',
      branch: 'feature/test',
      piSessionsRoot: root,
    });

    expect(sessions.map((session) => session.sessionId)).toEqual(['pi-subdir']);
  });

  it('filters Pi branch-scoped sessions by current branch', () => {
    const root = createTempDir();
    const projectDir = join(root, '--repo-project--');
    mkdirSync(projectDir, { recursive: true });
    cpSync(join(fixturesDir, 'pi-branch.jsonl'), join(projectDir, 'pi-branch.jsonl'));

    const sessions = scanPiSessions({
      repoRoot: '/repo/project',
      branch: 'feature/other',
      piSessionsRoot: root,
    });

    expect(sessions).toEqual([]);
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

  it('scans Pi sessions from project directories', () => {
    const root = createTempDir();
    const repoRoot = '/repo/project';
    const projectDir = join(root, '--repo-project--');
    mkdirSync(projectDir, { recursive: true });
    cpSync(join(fixturesDir, 'pi-branch.jsonl'), join(projectDir, 'pi-branch.jsonl'));
    cpSync(join(fixturesDir, 'pi-repo.jsonl'), join(projectDir, 'pi-repo.jsonl'));

    const sessions = scanPiSessions({
      repoRoot,
      branch: 'feature/test',
      piSessionsRoot: root,
    });

    expect(sessions.map((session) => [session.sessionId, session.scope]).sort()).toEqual([
      ['pi-1', AgentSessionScope.Branch],
      ['pi-2', AgentSessionScope.Repo],
    ]);
  });

  it('scans all providers', () => {
    const root = createTempDir();
    const repoRoot = '/repo/project';
    const claudeDir = join(root, 'claude', getClaudeProjectKey(repoRoot));
    const codexDir = join(root, 'codex', '2026', '05', '01');
    const piDir = join(root, 'pi', '--repo-project--');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(codexDir, { recursive: true });
    mkdirSync(piDir, { recursive: true });
    cpSync(join(fixturesDir, 'claude.jsonl'), join(claudeDir, 'claude.jsonl'));
    cpSync(join(fixturesDir, 'codex-native.jsonl'), join(codexDir, 'codex-native.jsonl'));
    cpSync(join(fixturesDir, 'pi-branch.jsonl'), join(piDir, 'pi-branch.jsonl'));

    const sessions = scanAgentSessions({
      repoRoot,
      branch: 'feature/test',
      claudeProjectsRoot: dirname(claudeDir),
      codexSessionsRoot: join(root, 'codex'),
      piSessionsRoot: join(root, 'pi'),
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(sessions.map((session) => session.provider).sort()).toEqual([
      AgentSessionProvider.Claude,
      AgentSessionProvider.Codex,
      AgentSessionProvider.Pi,
    ]);
  });
});
