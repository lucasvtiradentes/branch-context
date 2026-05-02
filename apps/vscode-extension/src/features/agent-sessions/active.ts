import { type ExecFileException, execFile } from 'node:child_process';
import type { AgentSession } from '@branch-context/core';
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { branchContextState } from '../../vscode/state';

const FILE_ACTIVITY_TTL_MS = 30_000;
const CLOSED_FILE_ACTIVITY_SUPPRESS_MS = 5_000;
const PENDING_TERMINAL_TTL_MS = 60_000;
const PROCESS_ACTIVITY_POLL_MS = 2_000;

type ActiveSessionRef = {
  key: string;
  path: string | null;
};

type AgentSessionKeySource = Pick<AgentSession, 'provider' | 'sessionId'>;
type ActiveAgentSessionSource = AgentSessionKeySource & Pick<AgentSession, 'path'>;
type TimeoutHandle = ReturnType<typeof setTimeout>;

type PendingTerminalRef = {
  terminal: vscode.Terminal;
  execution: vscode.TerminalShellExecution;
  timer: TimeoutHandle;
};

let refreshTree: (() => void) | undefined;
const activeFilePaths = new Set<string>();
const activeTerminalKeys = new Set<string>();
const fileTimers = new Map<string, TimeoutHandle>();
const suppressedFileTimers = new Map<string, TimeoutHandle>();
const terminalSessions = new Map<vscode.Terminal, ActiveSessionRef>();
const terminalPaths = new Map<vscode.Terminal, string>();
const executionSessions = new Map<vscode.TerminalShellExecution, ActiveSessionRef>();
const executionPaths = new Map<vscode.TerminalShellExecution, string>();
const pendingTerminals = new Map<vscode.TerminalShellExecution, PendingTerminalRef>();
const activeProcessFilePaths = new Set<string>();
let processActivityTimer: ReturnType<typeof setInterval> | undefined;
let processActivityRefreshInFlight = false;

export function initializeActiveAgentSessions(
  context: vscode.ExtensionContext,
  refreshTreeCallback: () => void,
): void {
  refreshTree = refreshTreeCallback;
  refreshActiveProcessFiles();
  processActivityTimer = setInterval(refreshActiveProcessFiles, PROCESS_ACTIVITY_POLL_MS);

  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      const session = terminalSessions.get(terminal);
      const path = terminalPaths.get(terminal);
      terminalPaths.delete(terminal);
      if (!session) {
        if (path) {
          logger.debug(`[active-agent-sessions] terminal closed path=${path}`);
          clearActiveFilePath(path);
          clearActiveProcessFilePath(path);
          suppressFileActivity(path);
          refreshTree?.();
          return;
        }
        return;
      }

      logger.debug(`[active-agent-sessions] terminal closed session=${session.key}`);
      terminalSessions.delete(terminal);
      clearActiveSession(session);
      refreshTree?.();
    }),
    vscode.window.onDidStartTerminalShellExecution((event) => {
      const session = getSessionFromCommandLine(event.execution.commandLine.value);
      if (!session) {
        trackPendingTerminal(event);
        return;
      }

      logger.debug(
        `[active-agent-sessions] shell execution started session=${session.key} command=${formatCommandLine(event.execution.commandLine.value)}`,
      );
      executionSessions.set(event.execution, session);
      terminalSessions.set(event.terminal, session);
      activeTerminalKeys.add(session.key);
      refreshTree?.();
    }),
    vscode.window.onDidEndTerminalShellExecution((event) => {
      const session =
        executionSessions.get(event.execution) ??
        getSessionFromCommandLine(event.execution.commandLine.value);
      const path = executionPaths.get(event.execution);
      executionPaths.delete(event.execution);
      clearPendingTerminal(event.execution);
      if (!session) {
        if (path) {
          logger.debug(
            `[active-agent-sessions] shell execution ended path=${path} exit=${event.exitCode ?? 'unknown'} command=${formatCommandLine(event.execution.commandLine.value)}`,
          );
          terminalPaths.delete(event.terminal);
          clearActiveFilePath(path);
          clearActiveProcessFilePath(path);
          suppressFileActivity(path);
          refreshTree?.();
        }
        return;
      }

      logger.debug(
        `[active-agent-sessions] shell execution ended session=${session.key} exit=${event.exitCode ?? 'unknown'} command=${formatCommandLine(event.execution.commandLine.value)}`,
      );
      executionSessions.delete(event.execution);
      terminalSessions.delete(event.terminal);
      clearActiveSession(session);
      refreshTree?.();
    }),
    {
      dispose: () => {
        for (const timer of fileTimers.values()) {
          clearTimeout(timer);
        }
        for (const timer of suppressedFileTimers.values()) {
          clearTimeout(timer);
        }
        fileTimers.clear();
        suppressedFileTimers.clear();
        activeFilePaths.clear();
        activeTerminalKeys.clear();
        terminalSessions.clear();
        terminalPaths.clear();
        executionSessions.clear();
        executionPaths.clear();
        for (const pending of pendingTerminals.values()) {
          clearTimeout(pending.timer);
        }
        pendingTerminals.clear();
        if (processActivityTimer) {
          clearInterval(processActivityTimer);
          processActivityTimer = undefined;
        }
        activeProcessFilePaths.clear();
      },
    },
  );
}

export function isAgentSessionActive(session: ActiveAgentSessionSource): boolean {
  const key = getSessionKey(session);
  const path = session.path ?? '';
  return (
    activeTerminalKeys.has(key) ||
    activeFilePaths.has(path) ||
    activeProcessFilePaths.has(path) ||
    Array.from(terminalPaths.values()).includes(path)
  );
}

export function markAgentSessionFileActive(path: string): void {
  if (suppressedFileTimers.has(path)) {
    logger.debug(`[active-agent-sessions] file active suppressed path=${path}`);
    return;
  }

  logger.debug(`[active-agent-sessions] file active path=${path}`);
  activeFilePaths.add(path);
  bindPendingTerminalToPath(path);
  refreshTree?.();

  const existingTimer = fileTimers.get(path);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  fileTimers.set(
    path,
    setTimeout(() => {
      logger.debug(`[active-agent-sessions] file activity expired path=${path}`);
      fileTimers.delete(path);
      activeFilePaths.delete(path);
      refreshTree?.();
    }, FILE_ACTIVITY_TTL_MS),
  );
}

export function markAgentSessionTerminalActive(
  terminal: vscode.Terminal,
  session: ActiveAgentSessionSource,
): void {
  const activeSession = getActiveSessionRef(session);
  logger.debug(
    `[active-agent-sessions] terminal marked active session=${activeSession.key} path=${activeSession.path ?? 'none'}`,
  );
  terminalSessions.set(terminal, activeSession);
  activeTerminalKeys.add(activeSession.key);
  refreshTree?.();
}

function trackPendingTerminal(event: vscode.TerminalShellExecutionStartEvent): void {
  clearPendingTerminal(event.execution);
  pendingTerminals.set(event.execution, {
    terminal: event.terminal,
    execution: event.execution,
    timer: setTimeout(() => {
      pendingTerminals.delete(event.execution);
    }, PENDING_TERMINAL_TTL_MS),
  });
}

function bindPendingTerminalToPath(path: string): void {
  const pending = Array.from(pendingTerminals.values()).at(-1);
  if (!pending) {
    return;
  }

  logger.debug(
    `[active-agent-sessions] pending terminal bound path=${path} command=${formatCommandLine(pending.execution.commandLine.value)}`,
  );
  terminalPaths.set(pending.terminal, path);
  executionPaths.set(pending.execution, path);
  clearPendingTerminal(pending.execution);
}

function clearPendingTerminal(execution: vscode.TerminalShellExecution): void {
  const pending = pendingTerminals.get(execution);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingTerminals.delete(execution);
}

function clearActiveSession(session: ActiveSessionRef): void {
  logger.debug(
    `[active-agent-sessions] clear active session=${session.key} path=${session.path ?? 'none'}`,
  );
  activeTerminalKeys.delete(session.key);
  if (session.path) {
    clearActiveFilePath(session.path);
    clearActiveProcessFilePath(session.path);
    suppressFileActivity(session.path);
  }
}

function clearActiveFilePath(path: string): void {
  const timer = fileTimers.get(path);
  if (timer) {
    clearTimeout(timer);
    fileTimers.delete(path);
  }
  logger.debug(`[active-agent-sessions] clear file active path=${path}`);
  activeFilePaths.delete(path);
}

function clearActiveProcessFilePath(path: string): void {
  if (!activeProcessFilePaths.delete(path)) {
    return;
  }

  logger.debug(`[active-agent-sessions] clear process active path=${path}`);
}

function suppressFileActivity(path: string): void {
  const existingTimer = suppressedFileTimers.get(path);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  logger.debug(`[active-agent-sessions] suppress file active path=${path}`);
  suppressedFileTimers.set(
    path,
    setTimeout(() => {
      suppressedFileTimers.delete(path);
      logger.debug(`[active-agent-sessions] suppress file active expired path=${path}`);
    }, CLOSED_FILE_ACTIVITY_SUPPRESS_MS),
  );
}

function getSessionFromCommandLine(commandLine: string): ActiveSessionRef | null {
  const normalizedCommand = commandLine.toLowerCase();

  for (const session of branchContextState.get().agentSessions) {
    if (normalizedCommand.includes(session.sessionId.toLowerCase())) {
      return getActiveSessionRef(session);
    }
  }

  return null;
}

function getActiveSessionRef(session: ActiveAgentSessionSource) {
  return {
    key: getSessionKey(session),
    path: session.path,
  };
}

function getSessionKey(session: AgentSessionKeySource): string {
  return `${session.provider}:${session.sessionId}`;
}

function refreshActiveProcessFiles(): void {
  if (processActivityRefreshInFlight) {
    return;
  }

  processActivityRefreshInFlight = true;
  execFile('lsof', ['-Fn', '-c', 'codex', '-c', 'claude'], { timeout: 2_000 }, (error, stdout) => {
    processActivityRefreshInFlight = false;
    if (error && !stdout && isProcessLookupTimeout(error)) {
      return;
    }

    if (error && !stdout && activeProcessFilePaths.size === 0) {
      return;
    }

    const nextPaths = new Set(
      stdout
        .split(/\r?\n/)
        .filter((line) => line.startsWith('n') && line.endsWith('.jsonl'))
        .map((line) => line.slice(1)),
    );
    if (sameSet(activeProcessFilePaths, nextPaths)) {
      if (activeProcessFilePaths.size > 0) {
        refreshTree?.();
      }
      return;
    }

    activeProcessFilePaths.clear();
    for (const path of nextPaths) {
      activeProcessFilePaths.add(path);
    }
    logger.debug(`[active-agent-sessions] process active files=${activeProcessFilePaths.size}`);
    refreshTree?.();
  });
}

function isProcessLookupTimeout(error: ExecFileException): boolean {
  return error.killed === true;
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function formatCommandLine(commandLine: string): string {
  const value = commandLine.replace(/\s+/g, ' ').trim();
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}
