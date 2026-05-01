import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getClaudeProjectKey,
  parseClaudeSessionFile,
  parseCodexSessionFile,
  scanAgentSessions,
  scanClaudeSessions,
  scanCodexSessions,
} from '../src/services/agents';
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
    expect(sessions[0]?.scope).toBe('branch');
  });

  it('scans Codex sessions from bounded date buckets', () => {
    const root = createTempDir();
    const dir = join(root, '2026', '05', '01');
    mkdirSync(dir, { recursive: true });
    cpSync(join(fixturesDir, 'codex-native.jsonl'), join(dir, 'codex-native.jsonl'));
    cpSync(join(fixturesDir, 'codex-repo.jsonl'), join(dir, 'codex-repo.jsonl'));

    const sessions = scanCodexSessions({
      repoRoot: '/repo/project',
      branch: 'feature/test',
      codexSessionsRoot: root,
      now: new Date('2026-05-01T15:00:00.000Z'),
    });

    expect(sessions.map((session) => [session.sessionId, session.scope]).sort()).toEqual([
      ['codex-1', 'branch'],
      ['codex-3', 'repo'],
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

    expect(sessions.map((session) => session.provider).sort()).toEqual(['claude', 'codex']);
  });
});
