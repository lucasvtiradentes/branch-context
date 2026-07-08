import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_SYMLINK, SESSIONS_FILE_NAME } from '../constants';
import { getBranchDir } from '../core/sync';
import { ensureBranchConfigDir } from './branch-config';
import { getBranchesDir } from './config';

export enum AgentSessionProvider {
  Claude = 'claude',
  Codex = 'codex',
  Pi = 'pi',
}

const agentSessionProviderValues = new Set<string>(Object.values(AgentSessionProvider));

export enum AgentSessionScope {
  Branch = 'branch',
  Repo = 'repo',
}

export type AgentSession = {
  provider: AgentSessionProvider;
  sessionId: string;
  branch: string;
  scope: AgentSessionScope;
  path: string | null;
  model: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  description: string | null;
  pinnedAt: string | null;
};

export type StoredAgentSession = Omit<AgentSession, 'branch' | 'scope'>;

export type AgentsFile = StoredAgentSession[];

export type AgentSessionInput = Omit<AgentSession, 'scope' | 'description' | 'pinnedAt'> & {
  scope?: AgentSessionScope;
  description?: string | null;
  pinnedAt?: string | null;
};

export function createEmptyAgentsFile(): AgentsFile {
  return [];
}

export function getBranchAgentsFilePathByDir(branchDir: string) {
  return join(ensureBranchConfigDir(branchDir), SESSIONS_FILE_NAME);
}

export function getCurrentAgentsFilePath(workspace: string) {
  return getBranchAgentsFilePathByDir(join(workspace, DEFAULT_SYMLINK));
}

export function getBranchAgentsFilePath(workspace: string, branch: string) {
  return getBranchAgentsFilePathByDir(getBranchDir(workspace, branch));
}

export function getBranchAgentsFilePathByKey(workspace: string, branchKey: string) {
  return getBranchAgentsFilePathByDir(join(getBranchesDir(workspace), branchKey));
}

export function createAgentSession(input: AgentSessionInput): AgentSession {
  return {
    ...input,
    scope: input.scope ?? AgentSessionScope.Branch,
    description: input.description ?? null,
    pinnedAt: input.pinnedAt ?? null,
  };
}

export function readAgentsFile(path: string): AgentsFile {
  if (!existsSync(path)) {
    return createEmptyAgentsFile();
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!isAgentsFileLike(parsed)) {
      return createEmptyAgentsFile();
    }
    return normalizeAgentsFile(parseAgentsFile(parsed));
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
  const nextSession = createStoredAgentSession(session);
  const existingIndex = data.findIndex(
    (existing) =>
      existing.provider === nextSession.provider && existing.sessionId === nextSession.sessionId,
  );

  if (existingIndex === -1) {
    data.push(nextSession);
  } else {
    data[existingIndex] = {
      ...data[existingIndex],
      ...nextSession,
    };
  }

  const normalized = normalizeAgentsFile(data);
  writeAgentsFile(path, normalized);
  return normalized;
}

export function updateAgentSessionMetadata(
  path: string,
  provider: AgentSessionProvider,
  sessionId: string,
  patch: Partial<Pick<StoredAgentSession, 'description' | 'pinnedAt'>>,
): AgentsFile {
  const data = readAgentsFile(path);
  const patched = data.map((session) =>
    session.provider === provider && session.sessionId === sessionId
      ? { ...session, ...patch }
      : session,
  );

  const normalized = normalizeAgentsFile(patched);
  writeAgentsFile(path, normalized);
  return normalized;
}

export function normalizeAgentsFile(data: AgentsFile): AgentsFile {
  return normalizeStoredAgentSessions(data);
}

function normalizeStoredAgentSessions(sessions: StoredAgentSession[]) {
  const sessionsByKey = new Map<string, StoredAgentSession>();

  for (const session of sessions
    .filter(isStoredAgentSession)
    .map(stripStoredAgentSession)
    .sort(compareStoredAgentSessions)) {
    const key = `${session.provider}:${session.sessionId}`;
    if (!sessionsByKey.has(key)) {
      sessionsByKey.set(key, session);
    }
  }

  return Array.from(sessionsByKey.values()).sort(compareStoredAgentSessions);
}

function stripStoredAgentSession(session: StoredAgentSession): StoredAgentSession {
  return {
    provider: session.provider,
    sessionId: session.sessionId,
    path: session.path,
    model: session.model,
    title: session.title,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    description: session.description,
    pinnedAt: session.pinnedAt,
  };
}

function compareStoredAgentSessions(left: StoredAgentSession, right: StoredAgentSession) {
  return compareSessionParts(left, right);
}

function compareSessionParts(
  left: Pick<AgentSession, 'provider' | 'sessionId' | 'startedAt' | 'updatedAt'>,
  right: Pick<AgentSession, 'provider' | 'sessionId' | 'startedAt' | 'updatedAt'>,
) {
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

function isAgentsFileLike(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseAgentsFile(data: unknown[]): AgentsFile {
  return data.flatMap(parseStoredAgentSession);
}

function createStoredAgentSession(input: AgentSessionInput | AgentSession): StoredAgentSession {
  return {
    provider: input.provider,
    sessionId: input.sessionId,
    path: input.path,
    model: input.model,
    title: input.title,
    startedAt: input.startedAt,
    updatedAt: input.updatedAt,
    description: input.description ?? null,
    pinnedAt: input.pinnedAt ?? null,
  };
}

function parseStoredAgentSession(value: unknown): StoredAgentSession[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const session = value as Partial<StoredAgentSession>;
  if (
    !(
      isAgentSessionProvider(session.provider) &&
      typeof session.sessionId === 'string' &&
      isNullableString(session.path) &&
      isNullableString(session.model) &&
      isNullableString(session.title) &&
      isNullableString(session.startedAt) &&
      isNullableString(session.updatedAt) &&
      isNullableString(session.description) &&
      isNullableString(session.pinnedAt)
    )
  ) {
    return [];
  }

  return [
    {
      provider: session.provider,
      sessionId: session.sessionId,
      path: session.path,
      model: session.model,
      title: session.title,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      description: session.description,
      pinnedAt: session.pinnedAt,
    },
  ];
}

function isStoredAgentSession(value: unknown): value is StoredAgentSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<StoredAgentSession>;
  return (
    isAgentSessionProvider(session.provider) &&
    typeof session.sessionId === 'string' &&
    isNullableString(session.path) &&
    isNullableString(session.model) &&
    isNullableString(session.title) &&
    isNullableString(session.startedAt) &&
    isNullableString(session.updatedAt) &&
    isNullableString(session.description) &&
    isNullableString(session.pinnedAt)
  );
}

function isAgentSessionProvider(value: unknown): value is AgentSessionProvider {
  return typeof value === 'string' && agentSessionProviderValues.has(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
