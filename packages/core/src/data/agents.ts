import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AGENTS_FILE_NAME, DEFAULT_SYMLINK } from '../constants';
import { getBranchDir, sanitizeBranchName } from '../core/sync';

export enum AgentSessionProvider {
  Claude = 'claude',
  Codex = 'codex',
}

export enum AgentSessionScope {
  Branch = 'branch',
  Repo = 'repo',
}

export type AgentSession = {
  provider: AgentSessionProvider;
  sessionId: string;
  repoRoot: string;
  branch: string;
  branchKey: string;
  scope: AgentSessionScope;
  path: string | null;
  model: string | null;
  source: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

export type AgentsFile = {
  version: 1;
  sessions: AgentSession[];
};

export type AgentSessionInput = Omit<AgentSession, 'scope'> & {
  scope?: AgentSessionScope;
};

export function createEmptyAgentsFile(): AgentsFile {
  return {
    version: 1,
    sessions: [],
  };
}

export function getCurrentAgentsFilePath(workspace: string) {
  return join(workspace, DEFAULT_SYMLINK, AGENTS_FILE_NAME);
}

export function getBranchAgentsFilePath(workspace: string, branch: string) {
  return join(getBranchDir(workspace, branch), AGENTS_FILE_NAME);
}

export function getBranchAgentsFilePathByKey(workspace: string, branchKey: string) {
  return join(workspace, '.bctx', 'branches', branchKey, AGENTS_FILE_NAME);
}

export function createAgentSession(input: AgentSessionInput): AgentSession {
  return {
    ...input,
    branchKey: input.branchKey || sanitizeBranchName(input.branch),
    scope: input.scope ?? AgentSessionScope.Branch,
  };
}

export function readAgentsFile(path: string): AgentsFile {
  if (!existsSync(path)) {
    return createEmptyAgentsFile();
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!isAgentsFile(parsed)) {
      return createEmptyAgentsFile();
    }
    return parsed;
  } catch {
    return createEmptyAgentsFile();
  }
}

export function writeAgentsFile(path: string, data: AgentsFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalizeAgentsFile(data), null, 2)}\n`);
}

export function upsertAgentSession(path: string, session: AgentSessionInput): AgentsFile {
  const data = readAgentsFile(path);
  const nextSession = createAgentSession(session);
  const existingIndex = data.sessions.findIndex(
    (existing) =>
      existing.provider === nextSession.provider && existing.sessionId === nextSession.sessionId,
  );

  if (existingIndex === -1) {
    data.sessions.push(nextSession);
  } else {
    data.sessions[existingIndex] = {
      ...data.sessions[existingIndex],
      ...nextSession,
    };
  }

  const normalized = normalizeAgentsFile(data);
  writeAgentsFile(path, normalized);
  return normalized;
}

export function normalizeAgentsFile(data: AgentsFile): AgentsFile {
  return {
    version: 1,
    sessions: data.sessions.filter(isAgentSession).sort(compareAgentSessions),
  };
}

function compareAgentSessions(left: AgentSession, right: AgentSession) {
  const leftTime = left.updatedAt ?? left.startedAt ?? '';
  const rightTime = right.updatedAt ?? right.startedAt ?? '';
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.sessionId.localeCompare(right.sessionId);
}

function isAgentsFile(value: unknown): value is AgentsFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Partial<AgentsFile>;
  return data.version === 1 && Array.isArray(data.sessions) && data.sessions.every(isAgentSession);
}

function isAgentSession(value: unknown): value is AgentSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AgentSession>;
  return (
    (session.provider === AgentSessionProvider.Claude ||
      session.provider === AgentSessionProvider.Codex) &&
    typeof session.sessionId === 'string' &&
    typeof session.repoRoot === 'string' &&
    typeof session.branch === 'string' &&
    typeof session.branchKey === 'string' &&
    (session.scope === AgentSessionScope.Branch || session.scope === AgentSessionScope.Repo) &&
    isNullableString(session.path) &&
    isNullableString(session.model) &&
    isNullableString(session.source) &&
    isNullableString(session.title) &&
    isNullableString(session.startedAt) &&
    isNullableString(session.updatedAt)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
