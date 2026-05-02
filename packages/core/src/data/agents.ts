import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AGENTS_FILE_NAME, DEFAULT_SYMLINK } from '../constants';
import { getBranchDir } from '../core/sync';
import { getBranchesDir } from './config';

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
  branch: string;
  scope: AgentSessionScope;
  path: string | null;
  model: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  pinned: AgentSessionPinnedData | null;
};

export type AgentSessionPin = {
  provider: AgentSessionProvider;
  sessionId: string;
  description: string;
  pinnedAt: string;
};

export type AgentSessionPinnedData = Omit<AgentSessionPin, 'provider' | 'sessionId'>;

export type StoredAgentSession = Omit<AgentSession, 'branch' | 'scope'>;

export type AgentsFile = {
  version: 1;
  sessions: StoredAgentSession[];
};

export type AgentSessionInput = Omit<AgentSession, 'scope' | 'pinned'> & {
  scope?: AgentSessionScope;
  pinned?: AgentSessionPinnedData | null;
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
  return join(getBranchesDir(workspace), branchKey, AGENTS_FILE_NAME);
}

export function createAgentSession(input: AgentSessionInput): AgentSession {
  return {
    ...input,
    scope: input.scope ?? AgentSessionScope.Branch,
    pinned: input.pinned ?? null,
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

export function upsertAgentSessionPin(
  path: string,
  pin: Omit<AgentSessionPin, 'pinnedAt'> & { pinnedAt?: string },
): AgentsFile {
  const data = readAgentsFile(path);
  const pinned = {
    description: pin.description,
    pinnedAt: pin.pinnedAt ?? new Date().toISOString(),
  };
  data.sessions = data.sessions.map((session) =>
    session.provider === pin.provider && session.sessionId === pin.sessionId
      ? { ...session, pinned }
      : session,
  );

  const normalized = normalizeAgentsFile(data);
  writeAgentsFile(path, normalized);
  return normalized;
}

export function removeAgentSessionPin(
  path: string,
  provider: AgentSessionProvider,
  sessionId: string,
): AgentsFile {
  const data = readAgentsFile(path);
  data.sessions = data.sessions.map((session) =>
    session.provider === provider && session.sessionId === sessionId
      ? { ...session, pinned: null }
      : session,
  );

  const normalized = normalizeAgentsFile(data);
  writeAgentsFile(path, normalized);
  return normalized;
}

export function normalizeAgentsFile(data: AgentsFile): AgentsFile {
  return {
    version: 1,
    sessions: normalizeStoredAgentSessions(data.sessions),
  };
}

export function getAgentSessionPins(data: AgentsFile): AgentSessionPin[] {
  return data.sessions
    .flatMap((session) =>
      session.pinned
        ? [
            {
              provider: session.provider,
              sessionId: session.sessionId,
              description: session.pinned.description,
              pinnedAt: session.pinned.pinnedAt,
            },
          ]
        : [],
    )
    .sort(compareAgentSessionPins);
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
    pinned: session.pinned,
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

function compareAgentSessionPins(left: AgentSessionPin, right: AgentSessionPin) {
  if (left.pinnedAt !== right.pinnedAt) {
    return right.pinnedAt.localeCompare(left.pinnedAt);
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.sessionId.localeCompare(right.sessionId);
}

function isAgentsFileLike(value: unknown): value is {
  version: 1;
  sessions: unknown[];
  pinnedSessions?: unknown[];
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Partial<AgentsFile> & { pinnedSessions?: unknown };
  return data.version === 1 && Array.isArray(data.sessions);
}

function parseAgentsFile(data: {
  version: 1;
  sessions: unknown[];
  pinnedSessions?: unknown[];
}): AgentsFile {
  const pins = Array.isArray(data.pinnedSessions)
    ? data.pinnedSessions.filter(isAgentSessionPin)
    : [];
  return {
    version: 1,
    sessions: data.sessions.flatMap((session) => parseStoredAgentSession(session, pins)),
  };
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
    pinned: input.pinned ?? null,
  };
}

function parseStoredAgentSession(value: unknown, pins: AgentSessionPin[]): StoredAgentSession[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const session = value as Partial<StoredAgentSession>;
  if (
    !(
      (session.provider === AgentSessionProvider.Claude ||
        session.provider === AgentSessionProvider.Codex) &&
      typeof session.sessionId === 'string' &&
      isNullableString(session.path) &&
      isNullableString(session.model) &&
      isNullableString(session.title) &&
      isNullableString(session.startedAt) &&
      isNullableString(session.updatedAt) &&
      isNullablePinnedData(session.pinned)
    )
  ) {
    return [];
  }

  const legacyPin = pins.find(
    (pin) => pin.provider === session.provider && pin.sessionId === session.sessionId,
  );

  return [
    {
      provider: session.provider,
      sessionId: session.sessionId,
      path: session.path,
      model: session.model,
      title: session.title,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      pinned: session.pinned ?? toPinnedData(legacyPin),
    },
  ];
}

function toPinnedData(pin: AgentSessionPin | undefined): AgentSessionPinnedData | null {
  return pin ? { description: pin.description, pinnedAt: pin.pinnedAt } : null;
}

function isStoredAgentSession(value: unknown): value is StoredAgentSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<StoredAgentSession>;
  return (
    (session.provider === AgentSessionProvider.Claude ||
      session.provider === AgentSessionProvider.Codex) &&
    typeof session.sessionId === 'string' &&
    isNullableString(session.path) &&
    isNullableString(session.model) &&
    isNullableString(session.title) &&
    isNullableString(session.startedAt) &&
    isNullableString(session.updatedAt) &&
    isNullablePinnedData(session.pinned)
  );
}

export function isAgentSessionPin(value: unknown): value is AgentSessionPin {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const pin = value as Partial<AgentSessionPin>;
  return (
    (pin.provider === AgentSessionProvider.Claude || pin.provider === AgentSessionProvider.Codex) &&
    typeof pin.sessionId === 'string' &&
    typeof pin.description === 'string' &&
    typeof pin.pinnedAt === 'string'
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullablePinnedData(value: unknown): value is AgentSessionPinnedData | null {
  if (value == null) {
    return true;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const pin = value as Partial<AgentSessionPinnedData>;
  return typeof pin.description === 'string' && typeof pin.pinnedAt === 'string';
}
