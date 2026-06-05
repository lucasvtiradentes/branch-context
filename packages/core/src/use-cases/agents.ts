import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_SYMLINK, SESSIONS_FILE_NAME } from '../constants';
import { getArchivedDir, listArchivedBranches, sanitizeBranchName } from '../core/sync';
import {
  type AgentSession,
  AgentSessionProvider,
  AgentSessionScope,
  createAgentSession,
  getBranchAgentsFilePath,
  getBranchAgentsFilePathByKey,
  getCurrentAgentsFilePath,
  normalizeAgentsFile,
  readAgentsFile,
  type StoredAgentSession,
  writeAgentsFile,
} from '../data/agents';
import { configExists } from '../data/config';
import { loadArchivedMeta } from '../data/meta';
import { gitCurrentBranch } from '../git';
import { asRecord, asString, parseJsonRecord } from '../utils/unknown';
import { syncCurrentBranch } from './actions';
import { collectBranchInfo } from './branch-info';

export type { AgentSession };

const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PARSED_SESSION_CACHE_ENTRIES = 2000;

export type AgentSessionScanOptions = {
  repoRoot: string;
  branch?: string | null;
  homeDir?: string;
  claudeProjectsRoot?: string;
  codexSessionsRoot?: string;
  piSessionsRoot?: string;
  now?: Date;
  maxFiles?: number;
  maxFileBytes?: number;
};

type ParsedClaudeSession = {
  sessionId: string | null;
  cwd: string | null;
  branch: string | null;
  model: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

type ParsedCodexSession = {
  sessionId: string | null;
  cwd: string | null;
  branch: string | null;
  model: string | null;
  source: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

type ParsedPiSession = {
  sessionId: string | null;
  cwd: string | null;
  branch: string | null;
  repoRoot: string | null;
  model: string | null;
  title: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

type SessionFileCandidate = {
  path: string;
  mtimeMs: number;
};

type ParsedSessionCacheEntry<T> = {
  mtimeMs: number;
  size: number;
  maxBytes: number;
  value: T;
};

const parsedClaudeSessionCache = new Map<string, ParsedSessionCacheEntry<ParsedClaudeSession>>();
const parsedCodexSessionCache = new Map<string, ParsedSessionCacheEntry<ParsedCodexSession>>();
const parsedPiSessionCache = new Map<string, ParsedSessionCacheEntry<ParsedPiSession>>();
const normalizedPathCache = new Map<string, string>();

export enum ClaudeSessionEventType {
  User = 'user',
  Assistant = 'assistant',
  CustomTitle = 'custom-title',
}

export enum CodexSessionEventType {
  SessionMeta = 'session_meta',
  TurnContext = 'turn_context',
  EventMessage = 'event_msg',
  ResponseItem = 'response_item',
}

export enum CodexPayloadType {
  UserMessage = 'user_message',
}

export enum PiSessionEventType {
  Session = 'session',
  ModelChange = 'model_change',
  Message = 'message',
  Custom = 'custom',
}

export const PiBranchContextCustomType = 'branch';

export enum AgentMessageRole {
  User = 'user',
}

export type AgentSessionsResult =
  | {
      ok: true;
      repoRoot: string;
      branch: string;
      branchKey: string;
      agentsFilePath: string | null;
      sessions: AgentSession[];
    }
  | {
      ok: false;
      reason: 'no_current_branch';
      message: string;
      repoRoot: string;
    };

export type SyncAgentSessionsResult =
  | (Extract<AgentSessionsResult, { ok: true }> & {
      written: boolean;
    })
  | Extract<AgentSessionsResult, { ok: false }>;

export type SyncAllAgentSessionsBranchResult = {
  branch: string;
  branchKey: string;
  agentsFilePath: string;
  sessions: AgentSession[];
  written: boolean;
  archived: boolean;
};

export type SyncAllAgentSessionsResult =
  | {
      ok: true;
      repoRoot: string;
      branches: SyncAllAgentSessionsBranchResult[];
      writtenCount: number;
      sessionCount: number;
    }
  | {
      ok: false;
      reason: 'not_initialized';
      message: string;
      repoRoot: string;
    };

export type MoveAgentSessionToBranchResult =
  | {
      ok: true;
      fromAgentsFilePath: string;
      toAgentsFilePath: string;
      sessionFilePath: string;
      patchedLines: number;
    }
  | {
      ok: false;
      reason:
        | 'session_not_found'
        | 'session_file_missing'
        | 'session_file_unpatchable'
        | 'unsupported_provider';
      message: string;
    };

export function getAgentSessions(
  repoRoot: string,
  options: Omit<AgentSessionScanOptions, 'repoRoot'> = {},
): AgentSessionsResult {
  const branch = options.branch ?? gitCurrentBranch(repoRoot);
  if (!branch) {
    return {
      ok: false,
      reason: 'no_current_branch',
      message: 'could not determine current branch',
      repoRoot,
    };
  }

  const branchKey = sanitizeBranchName(branch);
  const agentsFilePath = getExistingAgentsFilePath(repoRoot);
  const cachedSessions = agentsFilePath
    ? readAgentsFile(agentsFilePath).sessions.map((session) =>
        storedSessionToAgentSession(session, branch),
      )
    : [];
  const scannedSessions = scanAgentSessions({ ...options, repoRoot, branch });
  const sessions = mergeSessions(cachedSessions, scannedSessions)
    .filter((session) => session.scope === AgentSessionScope.Repo || session.branch === branch)
    .sort(compareSessions);

  return {
    ok: true,
    repoRoot,
    branch,
    branchKey,
    agentsFilePath,
    sessions,
  };
}

export function getCachedAgentSessions(
  repoRoot: string,
  options: Pick<AgentSessionScanOptions, 'branch'> = {},
): AgentSessionsResult {
  const branch = options.branch ?? gitCurrentBranch(repoRoot);
  if (!branch) {
    return {
      ok: false,
      reason: 'no_current_branch',
      message: 'could not determine current branch',
      repoRoot,
    };
  }

  const branchKey = sanitizeBranchName(branch);
  const agentsFilePath = getExistingAgentsFilePath(repoRoot);
  const sessions = agentsFilePath
    ? readAgentsFile(agentsFilePath)
        .sessions.map((session) => storedSessionToAgentSession(session, branch))
        .sort(compareSessions)
    : [];

  return {
    ok: true,
    repoRoot,
    branch,
    branchKey,
    agentsFilePath,
    sessions,
  };
}

export function syncAgentSessions(
  repoRoot: string,
  options: Omit<AgentSessionScanOptions, 'repoRoot'> = {},
): SyncAgentSessionsResult {
  ensureCurrentContext(repoRoot);
  const result = getAgentSessions(repoRoot, options);
  if (!result.ok) {
    return result;
  }

  const agentsFilePath = getExistingAgentsFilePath(repoRoot);
  if (!agentsFilePath) {
    return {
      ...result,
      agentsFilePath: null,
      written: false,
    };
  }

  const exactSessions = result.sessions.filter(
    (session) => session.scope === AgentSessionScope.Branch && session.branch === result.branch,
  );
  const currentAgentsFile = readAgentsFile(agentsFilePath);
  const nextAgentsFile = normalizeAgentsFile({
    ...currentAgentsFile,
    sessions: exactSessions,
  });
  const written = !agentsFilesEqual(currentAgentsFile, nextAgentsFile);
  if (written) {
    writeAgentsFile(agentsFilePath, nextAgentsFile);
  }

  return {
    ...result,
    agentsFilePath,
    sessions: exactSessions,
    written,
  };
}

export function syncAllAgentSessions(
  repoRoot: string,
  options: Omit<AgentSessionScanOptions, 'repoRoot' | 'branch'> = {},
): SyncAllAgentSessionsResult {
  if (!configExists(repoRoot)) {
    return {
      ok: false,
      reason: 'not_initialized',
      message: 'branch context is not initialized',
      repoRoot,
    };
  }

  const scannedSessions = scanAgentSessions({ ...options, repoRoot });
  const branches = getSyncAllAgentSessionTargets(repoRoot).map((target) =>
    syncAgentSessionsForBranch(target, scannedSessions),
  );

  return {
    ok: true,
    repoRoot,
    branches,
    writtenCount: branches.filter((branch) => branch.written).length,
    sessionCount: branches.reduce((total, branch) => total + branch.sessions.length, 0),
  };
}

export function moveAgentSessionToBranch(options: {
  repoRoot: string;
  provider: AgentSessionProvider;
  sessionId: string;
  fromBranch: string;
  toBranch: string;
  fromAgentsFilePath?: string;
  toAgentsFilePath?: string;
}): MoveAgentSessionToBranchResult {
  const fromAgentsFilePath =
    options.fromAgentsFilePath ?? getBranchAgentsFilePath(options.repoRoot, options.fromBranch);
  const toAgentsFilePath =
    options.toAgentsFilePath ?? getBranchAgentsFilePath(options.repoRoot, options.toBranch);
  const fromAgentsFile = readAgentsFile(fromAgentsFilePath);
  const session = fromAgentsFile.sessions.find(
    (candidate) =>
      candidate.provider === options.provider && candidate.sessionId === options.sessionId,
  );

  if (!session) {
    return {
      ok: false,
      reason: 'session_not_found',
      message: 'agent session was not found in source branch',
    };
  }

  if (!session.path || !existsSync(session.path)) {
    return {
      ok: false,
      reason: 'session_file_missing',
      message: 'agent session file does not exist',
    };
  }

  const patchResult = patchAgentSessionFileBranch(session.path, options.provider, options.toBranch);
  if (!patchResult.ok) {
    return patchResult;
  }

  const nextFromAgentsFile = normalizeAgentsFile({
    ...fromAgentsFile,
    sessions: fromAgentsFile.sessions.filter(
      (candidate) =>
        candidate.provider !== options.provider || candidate.sessionId !== options.sessionId,
    ),
  });
  const toAgentsFile = readAgentsFile(toAgentsFilePath);
  const nextToAgentsFile = normalizeAgentsFile({
    ...toAgentsFile,
    sessions: [
      ...toAgentsFile.sessions.filter(
        (candidate) =>
          candidate.provider !== options.provider || candidate.sessionId !== options.sessionId,
      ),
      session,
    ],
  });

  writeAgentsFile(fromAgentsFilePath, nextFromAgentsFile);
  writeAgentsFile(toAgentsFilePath, nextToAgentsFile);

  return {
    ok: true,
    fromAgentsFilePath,
    toAgentsFilePath,
    sessionFilePath: session.path,
    patchedLines: patchResult.patchedLines,
  };
}

export function scanAgentSessions(options: AgentSessionScanOptions): AgentSession[] {
  return [
    ...scanClaudeSessions(options),
    ...scanCodexSessions(options),
    ...scanPiSessions(options),
  ].sort(compareSessions);
}

export function scanClaudeSessions(options: AgentSessionScanOptions): AgentSession[] {
  const projectDir = getClaudeProjectDir(options);
  const files = listJsonlFiles(projectDir, options);

  return files
    .map((file) => ({ file, session: parseClaudeSessionFile(file, options.maxFileBytes) }))
    .filter(
      (
        value,
      ): value is {
        file: string;
        session: ParsedClaudeSession & { sessionId: string; branch: string };
      } => Boolean(value.session.sessionId && value.session.branch && value.session.cwd),
    )
    .filter(({ session }) => matchesRepo(session.cwd, options.repoRoot))
    .filter(({ session }) => !options.branch || session.branch === options.branch)
    .map(({ file, session }) =>
      createAgentSession({
        provider: AgentSessionProvider.Claude,
        sessionId: session.sessionId,
        branch: session.branch,
        scope: AgentSessionScope.Branch,
        path: file,
        model: session.model,
        title: session.title,
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
        description: null,
        pinnedAt: null,
      }),
    );
}

export function scanCodexSessions(options: AgentSessionScanOptions): AgentSession[] {
  const files = listCodexSessionFiles(options);

  return files
    .map((file) => ({ file, session: parseCodexSessionFile(file, options.maxFileBytes) }))
    .filter(({ session }) => Boolean(session.sessionId && session.cwd))
    .filter(({ session }) => matchesRepo(session.cwd, options.repoRoot))
    .map(({ file, session }) => codexSessionToAgent(file, session, options))
    .filter((session): session is AgentSession => Boolean(session))
    .filter(
      (session) =>
        !options.branch ||
        session.scope === AgentSessionScope.Repo ||
        session.branch === options.branch,
    )
    .sort(compareSessions);
}

export function scanPiSessions(options: AgentSessionScanOptions): AgentSession[] {
  const files = listPiSessionFiles(options);

  return files
    .map((file) => ({ file, session: parsePiSessionFile(file, options.maxFileBytes) }))
    .filter(({ session }) => Boolean(session.sessionId && session.cwd))
    .filter(({ session }) => matchesRepo(session.repoRoot ?? session.cwd, options.repoRoot))
    .map(({ file, session }) => piSessionToAgent(file, session, options))
    .filter((session): session is AgentSession => Boolean(session))
    .filter(
      (session) =>
        !options.branch ||
        session.scope === AgentSessionScope.Repo ||
        session.branch === options.branch,
    )
    .sort(compareSessions);
}

export function parseClaudeSessionFile(
  path: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): ParsedClaudeSession {
  return readParsedSessionCache(path, maxBytes, parsedClaudeSessionCache, () =>
    parseClaudeSessionFileUncached(path, maxBytes),
  );
}

function parseClaudeSessionFileUncached(path: string, maxBytes: number): ParsedClaudeSession {
  const parsed: ParsedClaudeSession = {
    sessionId: null,
    cwd: null,
    branch: null,
    model: null,
    title: null,
    startedAt: null,
    updatedAt: getFileUpdatedAt(path),
  };

  for (const line of readJsonLines(path, maxBytes)) {
    const data = parseJsonRecord(line);
    if (!data) {
      continue;
    }

    if (data.type === ClaudeSessionEventType.User) {
      parsed.sessionId ??= asString(data.sessionId);
      parsed.cwd ??= asString(data.cwd);
      parsed.branch ??= asString(data.gitBranch);
      parsed.startedAt ??= asString(data.timestamp);
      parsed.title ??= extractMessageTitle(data.message);
    } else if (data.type === ClaudeSessionEventType.Assistant) {
      const message = asRecord(data.message);
      parsed.model ??= asString(message?.model);
    } else if (data.type === ClaudeSessionEventType.CustomTitle) {
      parsed.title = asString(data.customTitle) ?? parsed.title;
    }
  }

  return parsed;
}

export function parseCodexSessionFile(
  path: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): ParsedCodexSession {
  return readParsedSessionCache(path, maxBytes, parsedCodexSessionCache, () =>
    parseCodexSessionFileUncached(path, maxBytes),
  );
}

function parseCodexSessionFileUncached(path: string, maxBytes: number): ParsedCodexSession {
  const parsed: ParsedCodexSession = {
    sessionId: null,
    cwd: null,
    branch: null,
    model: null,
    source: null,
    title: null,
    startedAt: null,
    updatedAt: getFileUpdatedAt(path),
  };
  let responseItemTitle: string | null = null;

  for (const line of readJsonLines(path, maxBytes)) {
    const data = parseJsonRecord(line);
    if (!data) {
      continue;
    }

    const payload = asRecord(data.payload);
    if (data.type === CodexSessionEventType.SessionMeta && payload) {
      parsed.sessionId ??= asString(payload.id);
      parsed.cwd ??= asString(payload.cwd);
      parsed.startedAt ??= asString(payload.timestamp);
      parsed.source ??= formatSource(payload.source);
      parsed.branch ??= asString(asRecord(payload.git)?.branch);
    } else if (data.type === CodexSessionEventType.TurnContext && payload) {
      parsed.model ??= asString(payload.model);
      parsed.cwd ??= asString(payload.cwd);
    } else if (
      data.type === CodexSessionEventType.EventMessage &&
      payload?.type === CodexPayloadType.UserMessage
    ) {
      parsed.title ??= asString(payload.message);
    } else if (
      data.type === CodexSessionEventType.ResponseItem &&
      payload?.role === AgentMessageRole.User
    ) {
      responseItemTitle ??= extractAgentContentTitle(payload.content);
    }
  }

  parsed.title ??= responseItemTitle;

  return parsed;
}

export function parsePiSessionFile(
  path: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): ParsedPiSession {
  return readParsedSessionCache(path, maxBytes, parsedPiSessionCache, () =>
    parsePiSessionFileUncached(path, maxBytes),
  );
}

function parsePiSessionFileUncached(path: string, maxBytes: number): ParsedPiSession {
  const parsed: ParsedPiSession = {
    sessionId: null,
    cwd: null,
    branch: null,
    repoRoot: null,
    model: null,
    title: null,
    startedAt: null,
    updatedAt: getFileUpdatedAt(path),
  };

  for (const line of readJsonLines(path, maxBytes)) {
    const data = parseJsonRecord(line);
    if (!data) {
      continue;
    }

    if (data.type === PiSessionEventType.Session) {
      parsed.sessionId ??= asString(data.id);
      parsed.cwd ??= asString(data.cwd);
      parsed.startedAt ??= asString(data.timestamp);
    } else if (data.type === PiSessionEventType.ModelChange) {
      parsed.model ??= asString(data.modelId);
    } else if (data.type === PiSessionEventType.Message) {
      const message = asRecord(data.message);
      if (message?.role === AgentMessageRole.User) {
        parsed.title ??= extractMessageTitle(message);
      }
    } else if (
      data.type === PiSessionEventType.Custom &&
      data.customType === PiBranchContextCustomType
    ) {
      const branchContext = asRecord(data.data);
      parsed.branch = asString(branchContext?.gitBranch) ?? parsed.branch;
      parsed.repoRoot = asString(branchContext?.repoRoot) ?? parsed.repoRoot;
    }
  }

  return parsed;
}

export function getClaudeProjectKey(repoRoot: string) {
  return repoRoot.replace(/[^a-zA-Z0-9]/g, '-');
}

function codexSessionToAgent(
  file: string,
  session: ParsedCodexSession,
  options: AgentSessionScanOptions,
): AgentSession | null {
  if (!session.sessionId) {
    return null;
  }

  const exactBranch = session.branch;
  const branch = exactBranch ?? options.branch ?? '';

  return createAgentSession({
    provider: AgentSessionProvider.Codex,
    sessionId: session.sessionId,
    branch,
    scope: exactBranch ? AgentSessionScope.Branch : AgentSessionScope.Repo,
    path: file,
    model: session.model,
    title: session.title,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    description: null,
    pinnedAt: null,
  });
}

function piSessionToAgent(
  file: string,
  session: ParsedPiSession,
  options: AgentSessionScanOptions,
): AgentSession | null {
  if (!session.sessionId) {
    return null;
  }

  const exactBranch = session.branch;
  const branch = exactBranch ?? options.branch ?? '';

  return createAgentSession({
    provider: AgentSessionProvider.Pi,
    sessionId: session.sessionId,
    branch,
    scope: exactBranch ? AgentSessionScope.Branch : AgentSessionScope.Repo,
    path: file,
    model: session.model,
    title: session.title,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    description: null,
    pinnedAt: null,
  });
}

function getClaudeProjectDir(options: AgentSessionScanOptions) {
  return join(getClaudeProjectsRoot(options), getClaudeProjectKey(options.repoRoot));
}

function ensureCurrentContext(repoRoot: string) {
  if (!configExists(repoRoot)) {
    return;
  }

  if (existsSync(join(repoRoot, DEFAULT_SYMLINK))) {
    return;
  }

  syncCurrentBranch(repoRoot, { sound: false });
}

function getExistingAgentsFilePath(repoRoot: string) {
  const currentContextPath = join(repoRoot, DEFAULT_SYMLINK);
  if (!existsSync(currentContextPath)) {
    return null;
  }

  return getCurrentAgentsFilePath(repoRoot);
}

type SyncAllAgentSessionsTarget = {
  branch: string;
  branchKey: string;
  agentsFilePath: string;
  archived: boolean;
};

function getSyncAllAgentSessionTargets(repoRoot: string): SyncAllAgentSessionsTarget[] {
  const activeTargets = Array.from(collectBranchInfo(repoRoot).entries())
    .filter(([, info]) => info.context)
    .map(([branch, info]) => ({
      branch,
      branchKey: info.sanitized,
      agentsFilePath: getBranchAgentsFilePathByKey(repoRoot, info.sanitized),
      archived: false,
    }));
  const archivedMeta = loadArchivedMeta(repoRoot);
  const archivedDir = getArchivedDir(repoRoot);
  const archivedTargets = listArchivedBranches(repoRoot).map((branchKey) => ({
    branch: archivedMeta[branchKey]?.branch ?? branchKey,
    branchKey,
    agentsFilePath: join(archivedDir, branchKey, SESSIONS_FILE_NAME),
    archived: true,
  }));

  return [...activeTargets, ...archivedTargets].sort((left, right) =>
    left.branch.localeCompare(right.branch),
  );
}

function syncAgentSessionsForBranch(
  target: SyncAllAgentSessionsTarget,
  scannedSessions: AgentSession[],
): SyncAllAgentSessionsBranchResult {
  const { branch, branchKey, agentsFilePath, archived } = target;
  const currentAgentsFile = readAgentsFile(agentsFilePath);
  const cachedSessions = currentAgentsFile.sessions.map((session) =>
    storedSessionToAgentSession(session, branch),
  );
  const sessions = mergeSessions(cachedSessions, scannedSessions)
    .filter((session) => session.scope === AgentSessionScope.Branch && session.branch === branch)
    .sort(compareSessions);
  const nextAgentsFile = normalizeAgentsFile({
    ...currentAgentsFile,
    sessions,
  });
  const written = !agentsFilesEqual(currentAgentsFile, nextAgentsFile);

  if (written) {
    writeAgentsFile(agentsFilePath, nextAgentsFile);
  }

  return {
    branch,
    branchKey,
    agentsFilePath,
    sessions,
    written,
    archived,
  };
}

function mergeSessions(...groups: AgentSession[][]) {
  const sessions = new Map<string, AgentSession>();
  for (const session of groups.flat()) {
    const existing = sessions.get(`${session.provider}:${session.sessionId}`);
    sessions.set(`${session.provider}:${session.sessionId}`, {
      ...existing,
      ...session,
      description: session.description ?? existing?.description ?? null,
      pinnedAt: session.pinnedAt ?? existing?.pinnedAt ?? null,
    });
  }
  return Array.from(sessions.values());
}

function storedSessionToAgentSession(session: StoredAgentSession, branch: string) {
  return createAgentSession({
    ...session,
    branch,
    scope: AgentSessionScope.Branch,
  });
}

function agentsFilesEqual(
  left: ReturnType<typeof readAgentsFile>,
  right: ReturnType<typeof readAgentsFile>,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function patchAgentSessionFileBranch(
  path: string,
  provider: AgentSessionProvider,
  branch: string,
): { ok: true; patchedLines: number } | Extract<MoveAgentSessionToBranchResult, { ok: false }> {
  if (
    provider !== AgentSessionProvider.Claude &&
    provider !== AgentSessionProvider.Codex &&
    provider !== AgentSessionProvider.Pi
  ) {
    return {
      ok: false,
      reason: 'unsupported_provider',
      message: `unsupported agent provider: ${provider}`,
    };
  }

  const original = readFileSync(path, 'utf8');
  const hasFinalNewline = original.endsWith('\n');
  const lines = original.split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }

  let patchedLines = 0;
  const nextLines = lines.map((line) => {
    const data = parseJsonRecord(line);
    if (!data) {
      return line;
    }

    const patched = patchAgentSessionLineBranch(data, provider, branch);
    if (!patched) {
      return line;
    }

    patchedLines += 1;
    return JSON.stringify(data);
  });

  if (patchedLines === 0) {
    return {
      ok: false,
      reason: 'session_file_unpatchable',
      message: 'agent session file branch metadata could not be patched',
    };
  }

  writeFileSync(path, `${nextLines.join('\n')}${hasFinalNewline ? '\n' : ''}`);
  return { ok: true, patchedLines };
}

function patchAgentSessionLineBranch(
  data: Record<string, unknown>,
  provider: AgentSessionProvider,
  branch: string,
) {
  if (provider === AgentSessionProvider.Claude && typeof data.gitBranch === 'string') {
    data.gitBranch = branch;
    return true;
  }

  if (provider === AgentSessionProvider.Codex) {
    const payload = asRecord(data.payload);
    const git = asRecord(payload?.git);
    if (git && typeof git.branch === 'string') {
      git.branch = branch;
      return true;
    }
  }

  if (provider === AgentSessionProvider.Pi) {
    const branchContext = asRecord(data.data);
    if (
      data.type === PiSessionEventType.Custom &&
      data.customType === PiBranchContextCustomType &&
      branchContext &&
      typeof branchContext.gitBranch === 'string'
    ) {
      branchContext.gitBranch = branch;
      return true;
    }
  }

  return false;
}

function getClaudeProjectsRoot(options: AgentSessionScanOptions) {
  return options.claudeProjectsRoot ?? join(options.homeDir ?? homedir(), '.claude', 'projects');
}

function getCodexSessionsRoot(options: AgentSessionScanOptions) {
  return options.codexSessionsRoot ?? join(options.homeDir ?? homedir(), '.codex', 'sessions');
}

function getPiSessionsRoot(options: AgentSessionScanOptions) {
  return (
    options.piSessionsRoot ??
    process.env.PI_CODING_AGENT_SESSION_DIR ??
    join(options.homeDir ?? homedir(), '.pi', 'agent', 'sessions')
  );
}

function listCodexSessionFiles(options: AgentSessionScanOptions) {
  const root = getCodexSessionsRoot(options);
  if (!existsSync(root)) {
    return [];
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const files: SessionFileCandidate[] = [];

  for (const year of listDirectoryNames(root).sort().reverse()) {
    for (const month of listDirectoryNames(join(root, year)).sort().reverse()) {
      for (const day of listDirectoryNames(join(root, year, month))
        .sort()
        .reverse()) {
        for (const file of listJsonlFiles(join(root, year, month, day), { ...options, maxFiles })) {
          try {
            const stat = statSync(file);
            if (stat.isFile()) {
              files.push({ path: file, mtimeMs: stat.mtimeMs });
            }
          } catch {}
        }
      }
    }
  }

  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, maxFiles)
    .map((entry) => entry.path);
}

function listPiSessionFiles(options: AgentSessionScanOptions) {
  const root = getPiSessionsRoot(options);
  if (!existsSync(root)) {
    return [];
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const files: SessionFileCandidate[] = [];

  for (const projectDir of listDirectoryNames(root)) {
    for (const file of listJsonlFiles(join(root, projectDir), { ...options, maxFiles })) {
      try {
        const stat = statSync(file);
        if (stat.isFile()) {
          files.push({ path: file, mtimeMs: stat.mtimeMs });
        }
      } catch {}
    }
  }

  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, maxFiles)
    .map((entry) => entry.path);
}

function listDirectoryNames(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function listJsonlFiles(dir: string, options: AgentSessionScanOptions) {
  if (!existsSync(dir)) {
    return [];
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => join(dir, name))
      .map((path) => ({ path, stat: statSync(path) }))
      .filter((entry) => entry.stat.isFile())
      .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
      .slice(0, maxFiles)
      .map((entry) => entry.path);
  } catch {
    return [];
  }
}

function readJsonLines(path: string, maxBytes: number) {
  try {
    const file = openSync(path, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const bytesRead = readSync(file, buffer, 0, maxBytes, 0);
      return buffer.toString('utf8', 0, bytesRead).split(/\r?\n/).filter(Boolean);
    } finally {
      closeSync(file);
    }
  } catch {
    return [];
  }
}

function getFileUpdatedAt(path: string) {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

function matchesRepo(cwd: string | null, repoRoot: string) {
  if (!cwd) {
    return false;
  }

  const normalizedCwd = normalizePath(cwd);
  const normalizedRepo = normalizePath(repoRoot);
  return normalizedCwd === normalizedRepo || normalizedCwd.startsWith(`${normalizedRepo}/`);
}

function normalizePath(path: string) {
  const cached = normalizedPathCache.get(path);
  if (cached) {
    return cached;
  }

  const resolved = resolve(path);
  let normalized: string;
  try {
    normalized = realpathSync.native(resolved).replaceAll('\\', '/');
  } catch {
    normalized = resolved.replaceAll('\\', '/');
  }
  normalizedPathCache.set(path, normalized);
  return normalized;
}

function extractMessageTitle(message: unknown) {
  const data = asRecord(message);
  if (!data) {
    return null;
  }
  return extractAgentContentTitle(data.content);
}

export function extractAgentContentTitle(content: unknown, maxLength = 120) {
  if (typeof content === 'string') {
    return cleanAgentTitle(content, maxLength);
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((item) => asString(asRecord(item)?.text))
    .filter(Boolean)
    .join(' ');

  return cleanAgentTitle(text, maxLength);
}

export function cleanAgentTitle(value: string | null, maxLength = 120) {
  const title = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!title || isInternalAgentUserMessage(title)) {
    return null;
  }
  return title.length > maxLength ? `${title.slice(0, maxLength - 3)}...` : title;
}

export function isInternalAgentUserMessage(text: string) {
  return text.startsWith('# AGENTS.md instructions for ');
}

function formatSource(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.subagent) {
    return 'subagent';
  }

  return null;
}

function compareSessions(left: AgentSession, right: AgentSession) {
  const leftTime = left.updatedAt ?? left.startedAt ?? '';
  const rightTime = right.updatedAt ?? right.startedAt ?? '';
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }

  return left.sessionId.localeCompare(right.sessionId);
}

function readParsedSessionCache<T>(
  path: string,
  maxBytes: number,
  cache: Map<string, ParsedSessionCacheEntry<T>>,
  read: () => T,
): T {
  const stat = getFileStat(path);
  const cached = cache.get(path);
  if (
    stat &&
    cached &&
    cached.mtimeMs === stat.mtimeMs &&
    cached.size === stat.size &&
    cached.maxBytes === maxBytes
  ) {
    return cached.value;
  }

  const value = read();
  if (stat) {
    cache.set(path, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      maxBytes,
      value,
    });
    trimParsedSessionCache(cache);
  }
  return value;
}

function trimParsedSessionCache<T>(cache: Map<string, ParsedSessionCacheEntry<T>>): void {
  while (cache.size > MAX_PARSED_SESSION_CACHE_ENTRIES) {
    const key = cache.keys().next().value;
    if (!key) {
      return;
    }
    cache.delete(key);
  }
}

function getFileStat(path: string) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
