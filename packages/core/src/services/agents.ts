import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_SYMLINK } from '../constants';
import { sanitizeBranchName } from '../core/sync';
import type { AgentSession } from '../data/agents';
import {
  createAgentSession,
  getCurrentAgentsFilePath,
  readAgentsFile,
  writeAgentsFile,
} from '../data/agents';
import { configExists } from '../data/config';
import { gitCurrentBranch } from '../utils/git';
import { syncCurrentBranch } from './actions';

export type { AgentSession };

const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;

export type AgentSessionScanOptions = {
  repoRoot: string;
  branch?: string | null;
  homeDir?: string;
  claudeProjectsRoot?: string;
  codexSessionsRoot?: string;
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

export function scanAgentSessions(options: AgentSessionScanOptions): AgentSession[] {
  return [...scanClaudeSessions(options), ...scanCodexSessions(options)].sort(compareSessions);
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
  const files = listCodexSessionFiles(options);

  return files
    .map((file) => ({ file, session: parseCodexSessionFile(file, options.maxFileBytes) }))
    .filter(({ session }) => Boolean(session.sessionId && session.cwd))
    .filter(({ session }) => matchesRepo(session.cwd, options.repoRoot))
    .map(({ file, session }) => codexSessionToAgent(file, session, options))
    .filter((session): session is AgentSession => Boolean(session))
    .filter(
      (session) => !options.branch || session.scope === 'repo' || session.branch === options.branch,
    )
    .sort(compareSessions);
}

export function parseClaudeSessionFile(
  path: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): ParsedClaudeSession {
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

export function parseCodexSessionFile(
  path: string,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): ParsedCodexSession {
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
    const data = parseJsonObject(line);
    if (!data) {
      continue;
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
      responseItemTitle ??= extractContentTitle(payload.content);
    }
  }

  parsed.title ??= responseItemTitle;

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
  const branchKey = exactBranch
    ? sanitizeBranchName(exactBranch)
    : options.branch
      ? sanitizeBranchName(options.branch)
      : '';

  return createAgentSession({
    provider: 'codex',
    sessionId: session.sessionId,
    repoRoot: options.repoRoot,
    branch,
    branchKey,
    scope: exactBranch ? 'branch' : 'repo',
    path: file,
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

function getClaudeProjectsRoot(options: AgentSessionScanOptions) {
  return options.claudeProjectsRoot ?? join(options.homeDir ?? homedir(), '.claude', 'projects');
}

function getCodexSessionsRoot(options: AgentSessionScanOptions) {
  return options.codexSessionsRoot ?? join(options.homeDir ?? homedir(), '.codex', 'sessions');
}

function listCodexSessionFiles(options: AgentSessionScanOptions) {
  const root = getCodexSessionsRoot(options);
  if (!existsSync(root)) {
    return [];
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const files: Array<{ path: string; mtimeMs: number }> = [];

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
  const resolved = resolve(path);
  try {
    return realpathSync.native(resolved).replaceAll('\\', '/');
  } catch {
    return resolved.replaceAll('\\', '/');
  }
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
  if (!title || isInternalUserMessage(title)) {
    return null;
  }
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function isInternalUserMessage(text: string) {
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
