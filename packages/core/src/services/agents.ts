import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { AGENTS_FILE_NAME, DEFAULT_SYMLINK } from '../constants';
import { sanitizeBranchName } from '../core/sync';
import type { AgentSession, AgentSessionInput } from '../data/agents';
import {
  createAgentSession,
  getCurrentAgentsFilePath,
  readAgentsFile,
  upsertAgentSession,
  writeAgentsFile,
} from '../data/agents';
import { configExists } from '../data/config';
import { gitCurrentBranch, gitRoot } from '../utils/git';
import { syncCurrentBranch } from './actions';

const DEFAULT_RECENT_DAYS = 2;
const DEFAULT_MAX_FILES = 200;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const BCTX_METADATA_MARKER = 'BCTX_SESSION_METADATA:';

export type AgentSessionScanOptions = {
  repoRoot: string;
  branch?: string | null;
  homeDir?: string;
  claudeProjectsRoot?: string;
  codexSessionsRoot?: string;
  now?: Date;
  recentDays?: number;
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
  metadata: BranchContextSessionMetadata | null;
};

type BranchContextSessionMetadata = {
  version: 1;
  provider: 'codex';
  repoRoot: string;
  branch: string;
  branchKey?: string;
  sessionId: string;
  path?: string;
  model?: string;
  source?: string;
  startedAt?: string;
};

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

export type CodexHookInput = {
  session_id?: string;
  transcript_path?: string;
  model?: string;
  source?: unknown;
  cwd?: string;
  timestamp?: string;
};

export type CaptureCodexSessionResult = {
  ok: true;
  captured: boolean;
  reason:
    | 'captured'
    | 'missing_session'
    | 'no_git_repo'
    | 'no_current_branch'
    | 'not_initialized'
    | 'missing_current_context';
  metadata: BranchContextSessionMetadata | null;
  agentsFilePath: string | null;
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
  const cachedSessions = agentsFilePath ? readAgentsFile(agentsFilePath).sessions : [];
  const scannedSessions = scanAgentSessions({ ...options, repoRoot, branch });
  const sessions = mergeSessions(cachedSessions, scannedSessions)
    .filter((session) => session.scope === 'repo' || session.branch === branch)
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
    (session) => session.scope === 'branch' && session.branch === result.branch,
  );
  writeAgentsFile(agentsFilePath, { version: 1, sessions: exactSessions });

  return {
    ...result,
    agentsFilePath,
    sessions: exactSessions,
    written: true,
  };
}

export function captureCodexSession(
  input: CodexHookInput,
  options: { cwd?: string; now?: Date } = {},
): CaptureCodexSessionResult {
  const sessionId = input.session_id;
  if (!sessionId) {
    return createCaptureResult('missing_session', null, null);
  }

  const repoRoot = gitRoot(input.cwd ?? options.cwd ?? process.cwd());
  if (!repoRoot) {
    return createCaptureResult('no_git_repo', null, null);
  }

  const branch = gitCurrentBranch(repoRoot);
  if (!branch) {
    return createCaptureResult('no_current_branch', null, null);
  }

  const branchKey = sanitizeBranchName(branch);
  const metadata: BranchContextSessionMetadata = {
    version: 1,
    provider: 'codex',
    repoRoot,
    branch,
    branchKey,
    sessionId,
    path: input.transcript_path,
    model: input.model,
    source: formatSource(input.source) ?? undefined,
    startedAt: input.timestamp ?? options.now?.toISOString() ?? new Date().toISOString(),
  };

  if (!configExists(repoRoot)) {
    return createCaptureResult('not_initialized', metadata, null);
  }

  ensureCurrentContext(repoRoot);
  const agentsFilePath = getExistingAgentsFilePath(repoRoot);
  if (!agentsFilePath) {
    return createCaptureResult('missing_current_context', metadata, null);
  }

  upsertAgentSession(
    agentsFilePath,
    createAgentSession({
      provider: 'codex',
      sessionId,
      repoRoot,
      branch,
      branchKey,
      scope: 'branch',
      path: input.transcript_path ?? null,
      model: input.model ?? null,
      source: formatSource(input.source),
      title: null,
      startedAt: metadata.startedAt ?? null,
      updatedAt: metadata.startedAt ?? null,
    }),
  );

  return createCaptureResult('captured', metadata, agentsFilePath);
}

export function scanAgentSessions(options: AgentSessionScanOptions): AgentSession[] {
  return [...scanClaudeSessions(options), ...scanCodexSessions(options)].sort(compareSessions);
}

export function scanClaudeSessions(options: AgentSessionScanOptions): AgentSession[] {
  const projectDir = getClaudeProjectDir(options);
  const files = listJsonlFiles(projectDir, options);

  return files
    .map((file) => ({ file, session: parseClaudeSessionFile(file) }))
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
        provider: 'claude',
        sessionId: session.sessionId,
        repoRoot: options.repoRoot,
        branch: session.branch,
        branchKey: sanitizeBranchName(session.branch),
        scope: 'branch',
        path: file,
        model: session.model,
        source: null,
        title: session.title,
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
      }),
    );
}

export function scanCodexSessions(options: AgentSessionScanOptions): AgentSession[] {
  const files = getCodexDateDirs(options).flatMap((dir) => listJsonlFiles(dir, options));

  return files
    .map((file) => ({ file, session: parseCodexSessionFile(file) }))
    .filter(({ session }) => Boolean(session.sessionId && session.cwd))
    .filter(({ session }) => matchesRepo(session.cwd, options.repoRoot))
    .map(({ file, session }) => codexSessionToAgent(file, session, options))
    .filter((session): session is AgentSession => Boolean(session))
    .filter(
      (session) => !options.branch || session.scope === 'repo' || session.branch === options.branch,
    )
    .sort(compareSessions);
}

export function parseClaudeSessionFile(path: string): ParsedClaudeSession {
  const parsed: ParsedClaudeSession = {
    sessionId: null,
    cwd: null,
    branch: null,
    model: null,
    title: null,
    startedAt: null,
    updatedAt: getFileUpdatedAt(path),
  };

  for (const line of readJsonLines(path)) {
    const data = parseJsonObject(line);
    if (!data) {
      continue;
    }

    if (data.type === 'user') {
      parsed.sessionId ??= asString(data.sessionId);
      parsed.cwd ??= asString(data.cwd);
      parsed.branch ??= asString(data.gitBranch);
      parsed.startedAt ??= asString(data.timestamp);
      parsed.title ??= extractMessageTitle(data.message);
    } else if (data.type === 'assistant') {
      const message = asRecord(data.message);
      parsed.model ??= asString(message?.model);
    } else if (data.type === 'custom-title') {
      parsed.title = asString(data.customTitle) ?? parsed.title;
    }
  }

  return parsed;
}

export function parseCodexSessionFile(path: string): ParsedCodexSession {
  const parsed: ParsedCodexSession = {
    sessionId: null,
    cwd: null,
    branch: null,
    model: null,
    source: null,
    title: null,
    startedAt: null,
    updatedAt: getFileUpdatedAt(path),
    metadata: null,
  };

  for (const line of readJsonLines(path)) {
    const data = parseJsonObject(line);
    if (!data) {
      continue;
    }

    const metadata = extractBranchContextMetadata(data);
    if (metadata) {
      parsed.metadata = metadata;
    }

    const payload = asRecord(data.payload);
    if (data.type === 'session_meta' && payload) {
      parsed.sessionId ??= asString(payload.id);
      parsed.cwd ??= asString(payload.cwd);
      parsed.startedAt ??= asString(payload.timestamp);
      parsed.source ??= formatSource(payload.source);
      parsed.branch ??= asString(asRecord(payload.git)?.branch);
    } else if (data.type === 'turn_context' && payload) {
      parsed.model ??= asString(payload.model);
      parsed.cwd ??= asString(payload.cwd);
    } else if (data.type === 'event_msg' && payload?.type === 'user_message') {
      parsed.title ??= asString(payload.message);
    } else if (data.type === 'response_item' && payload?.role === 'user') {
      parsed.title ??= extractContentTitle(payload.content);
    }
  }

  if (!parsed.branch && parsed.metadata) {
    parsed.branch = parsed.metadata.branch;
  }

  if (!parsed.model && parsed.metadata?.model) {
    parsed.model = parsed.metadata.model;
  }

  if (!parsed.startedAt && parsed.metadata?.startedAt) {
    parsed.startedAt = parsed.metadata.startedAt;
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

  const metadata = session.metadata;
  const exactBranch = session.branch ?? metadata?.branch ?? null;
  const branch = exactBranch ?? options.branch ?? '';
  const branchKey = exactBranch
    ? sanitizeBranchName(exactBranch)
    : options.branch
      ? sanitizeBranchName(options.branch)
      : '';

  return createAgentSession({
    provider: 'codex',
    sessionId: session.sessionId,
    repoRoot: metadata?.repoRoot ?? options.repoRoot,
    branch,
    branchKey: metadata?.branchKey ?? branchKey,
    scope: exactBranch ? 'branch' : 'repo',
    path: metadata?.path ?? file,
    model: session.model,
    source: session.source,
    title: session.title,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
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

function mergeSessions(...groups: AgentSession[][]) {
  const sessions = new Map<string, AgentSession>();
  for (const session of groups.flat()) {
    sessions.set(`${session.provider}:${session.sessionId}`, {
      ...sessions.get(`${session.provider}:${session.sessionId}`),
      ...session,
    });
  }
  return Array.from(sessions.values());
}

function createCaptureResult(
  reason: CaptureCodexSessionResult['reason'],
  metadata: BranchContextSessionMetadata | null,
  agentsFilePath: string | null,
): CaptureCodexSessionResult {
  return {
    ok: true,
    captured: reason === 'captured',
    reason,
    metadata,
    agentsFilePath,
  };
}

function getClaudeProjectsRoot(options: AgentSessionScanOptions) {
  return options.claudeProjectsRoot ?? join(options.homeDir ?? homedir(), '.claude', 'projects');
}

function getCodexSessionsRoot(options: AgentSessionScanOptions) {
  return options.codexSessionsRoot ?? join(options.homeDir ?? homedir(), '.codex', 'sessions');
}

function getCodexDateDirs(options: AgentSessionScanOptions) {
  const root = getCodexSessionsRoot(options);
  const now = options.now ?? new Date();
  const recentDays = options.recentDays ?? DEFAULT_RECENT_DAYS;
  const dirs: string[] = [];

  for (let index = 0; index < recentDays; index++) {
    const date = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);
    dirs.push(
      join(
        root,
        String(date.getFullYear()),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ),
    );
  }

  return dirs;
}

function listJsonlFiles(dir: string, options: AgentSessionScanOptions) {
  if (!existsSync(dir)) {
    return [];
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => join(dir, name))
      .map((path) => ({ path, stat: statSync(path) }))
      .filter((entry) => entry.stat.isFile() && entry.stat.size <= maxFileBytes)
      .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
      .slice(0, maxFiles)
      .map((entry) => entry.path);
  } catch {
    return [];
  }
}

function readJsonLines(path: string) {
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
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

function parseJsonObject(line: string) {
  try {
    const parsed = JSON.parse(line) as unknown;
    return asRecord(parsed);
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
  return resolve(path).replaceAll('\\', '/');
}

function extractMessageTitle(message: unknown) {
  const data = asRecord(message);
  if (!data) {
    return null;
  }
  return extractContentTitle(data.content);
}

function extractContentTitle(content: unknown) {
  if (typeof content === 'string') {
    return cleanTitle(content);
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((item) => asString(asRecord(item)?.text))
    .filter(Boolean)
    .join(' ');

  return cleanTitle(text);
}

function cleanTitle(value: string | null) {
  const title = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!title) {
    return null;
  }
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function extractBranchContextMetadata(data: Record<string, unknown>) {
  for (const text of collectStrings(data)) {
    const markerIndex = text.indexOf(BCTX_METADATA_MARKER);
    if (markerIndex === -1) {
      continue;
    }

    const jsonText = text.slice(markerIndex + BCTX_METADATA_MARKER.length).trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      continue;
    }

    const parsed = parseJsonObject(jsonText.slice(start, end + 1));
    if (isBranchContextSessionMetadata(parsed)) {
      return parsed;
    }
  }

  return null;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return Object.values(record).flatMap(collectStrings);
}

function isBranchContextSessionMetadata(
  value: Record<string, unknown> | null,
): value is BranchContextSessionMetadata {
  return (
    value?.version === 1 &&
    value.provider === 'codex' &&
    typeof value.repoRoot === 'string' &&
    typeof value.branch === 'string' &&
    typeof value.sessionId === 'string'
  );
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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compareSessions(left: AgentSession, right: AgentSession) {
  const leftTime = left.updatedAt ?? left.startedAt ?? '';
  const rightTime = right.updatedAt ?? right.startedAt ?? '';
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }

  return left.sessionId.localeCompare(right.sessionId);
}
