import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getAgentSessions, getClaudeProjectKey, syncAgentSessions } from '@branch-context/core';
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { type BranchContextExtensionState, branchContextState } from '../../vscode/state';
import { markAgentSessionFileActive } from './active';

const SYNC_DEBOUNCE_MS = 250;
const CODEX_WATCH_DAYS = 2;
const FOLLOW_UP_SYNC_DELAYS_MS = [1_500, 3_500];

let watcherDisposables: vscode.Disposable[] = [];
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let followUpSyncTimers: ReturnType<typeof setTimeout>[] = [];
let rolloverTimer: ReturnType<typeof setTimeout> | undefined;
let watcherKey: string | null = null;
let branchKey: string | null = null;

export function initializeAgentIndexer(context: vscode.ExtensionContext): void {
  const state = branchContextState.get();
  logger.info(
    `[agent-sessions:indexer] initialized workspace=${state.workspaceRoot ?? 'none'} initialized=${state.initialized} branch=${state.currentBranch ?? 'none'}`,
  );
  branchKey = getStateBranchKey(state);
  resetAgentWatchers(state);
  scheduleAgentSync('initialize');

  context.subscriptions.push(
    branchContextState.onDidChange((nextState) => {
      const nextBranchKey = getStateBranchKey(nextState);
      if (nextBranchKey !== branchKey) {
        logger.info(
          `[agent-sessions:indexer] branch key changed from=${branchKey ?? 'none'} to=${nextBranchKey}`,
        );
        branchKey = nextBranchKey;
        scheduleAgentSync('branch-change');
      }
      resetAgentWatchers(nextState);
    }),
    {
      dispose: () => {
        disposeAgentWatchers();
        clearTimers();
      },
    },
  );
}

function resetAgentWatchers(state: BranchContextExtensionState): void {
  const nextWatcherKey = getStateWatcherKey(state);
  if (nextWatcherKey === watcherKey) {
    return;
  }

  logger.info(
    `[agent-sessions:indexer] watcher reset key=${nextWatcherKey} workspace=${state.workspaceRoot ?? 'none'} initialized=${state.initialized} branch=${state.currentBranch ?? 'none'}`,
  );
  watcherKey = nextWatcherKey;
  disposeAgentWatchers();
  clearRolloverTimer();

  if (!state.workspaceRoot) {
    logger.warning('[agent-sessions:indexer] watcher registration skipped: no workspace');
    return;
  }

  registerProviderWatchers(state.workspaceRoot);
  scheduleRolloverReset();
}

function registerProviderWatchers(workspaceRoot: string): void {
  const homeDir = homedir();
  logger.info(`[agent-sessions:indexer] registering provider watchers workspace=${workspaceRoot}`);
  registerProviderWatcher(
    join(homeDir, '.claude', 'projects'),
    `${getClaudeProjectKey(workspaceRoot)}/*.jsonl`,
  );

  const codexRoot = join(homeDir, '.codex', 'sessions');
  for (const pattern of getCodexWatchPatterns()) {
    registerProviderWatcher(codexRoot, pattern);
  }
}

function registerProviderWatcher(root: string, pattern: string): void {
  if (!existsSync(root)) {
    logger.warning(`[agent-sessions:indexer] provider watcher skipped missing root=${root}`);
    return;
  }

  logger.info(
    `[agent-sessions:indexer] provider watcher registered root=${root} pattern=${pattern}`,
  );
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(root), pattern),
  );

  watcherDisposables.push(
    watcher,
    watcher.onDidCreate(handleAgentSessionFileChange),
    watcher.onDidChange(handleAgentSessionFileChange),
    watcher.onDidDelete(() => {
      scheduleAgentSync('file-delete');
    }),
  );
}

function handleAgentSessionFileChange(uri: vscode.Uri): void {
  markAgentSessionFileActive(uri.fsPath);
  scheduleAgentSync('file-change');
  scheduleFollowUpAgentSyncs();
}

function scheduleAgentSync(reason: string): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    syncCurrentAgentSessions(reason);
  }, SYNC_DEBOUNCE_MS);
}

function syncCurrentAgentSessions(reason: string): void {
  const state = branchContextState.get();
  if (!state.workspaceRoot) {
    logger.warning(`[agent-sessions:indexer] sync skipped reason=${reason} workspace=none`);
    return;
  }

  if (!state.currentBranch) {
    logger.warning(
      `[agent-sessions:indexer] sync skipped reason=${reason} workspace=${state.workspaceRoot} branch=none initialized=${state.initialized}`,
    );
    return;
  }

  if (state.initialized) {
    const startedAt = Date.now();
    const result = syncAgentSessions(state.workspaceRoot, { branch: state.currentBranch });
    const durationMs = Date.now() - startedAt;
    if (!result.ok) {
      logger.warning(
        `[agent-sessions:indexer] sync result mode=bctx reason=${reason} ok=false workspace=${state.workspaceRoot} branch=${state.currentBranch} result=${result.reason} ms=${durationMs}`,
      );
      return;
    }

    if (result.written) {
      logger.info(
        `[agent-sessions:indexer] sync result mode=bctx reason=${reason} workspace=${state.workspaceRoot} branch=${state.currentBranch} count=${result.sessions.length} written=${result.written} agentsFile=${result.agentsFilePath ?? 'none'} ms=${durationMs}`,
      );
    }
    return;
  }

  const startedAt = Date.now();
  try {
    const result = getAgentSessions(state.workspaceRoot, { branch: state.currentBranch });
    const durationMs = Date.now() - startedAt;
    const countChanged = result.ok && result.sessions.length !== state.agentSessions.length;
    if (!result.ok) {
      logger.warning(
        `[agent-sessions:indexer] scan result mode=no-bctx reason=${reason} ok=false workspace=${state.workspaceRoot} branch=${state.currentBranch} result=${result.reason} ms=${durationMs}`,
      );
      branchContextState.setAgentSessions([], 'no-bctx-scan-failed');
      return;
    }

    if (reason === 'initialize' || countChanged) {
      logger.info(
        `[agent-sessions:indexer] scan result mode=no-bctx reason=${reason} workspace=${state.workspaceRoot} branch=${state.currentBranch} count=${result.sessions.length} agentsFile=${result.agentsFilePath ?? 'none'} ms=${durationMs}`,
      );
    }
    branchContextState.setAgentSessions(result.sessions, 'no-bctx-scan');
  } catch (error) {
    logger.error(
      `[agent-sessions:indexer] scan failed mode=no-bctx reason=${reason} workspace=${state.workspaceRoot} branch=${state.currentBranch} error=${logger.formatError(error)}`,
    );
    branchContextState.setAgentSessions([], 'no-bctx-scan-error');
  }
}

function scheduleFollowUpAgentSyncs(): void {
  clearFollowUpSyncTimers();
  followUpSyncTimers = FOLLOW_UP_SYNC_DELAYS_MS.map((delay) =>
    setTimeout(() => {
      syncCurrentAgentSessions(`follow-up-${delay}`);
    }, delay),
  );
}

function getCodexWatchPatterns(): string[] {
  const now = new Date();
  const patterns: string[] = [];

  for (let index = 0; index < CODEX_WATCH_DAYS; index++) {
    const date = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);
    patterns.push(
      [
        String(date.getFullYear()),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
        '*.jsonl',
      ].join('/'),
    );
  }

  return patterns;
}

function scheduleRolloverReset(): void {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 1, 0);

  rolloverTimer = setTimeout(() => {
    watcherKey = null;
    resetAgentWatchers(branchContextState.get());
    scheduleAgentSync('day-rollover');
  }, nextDay.getTime() - now.getTime());
  logger.debug(
    `[agent-sessions:indexer] rollover reset scheduled ms=${nextDay.getTime() - now.getTime()}`,
  );
}

function getStateBranchKey(state: BranchContextExtensionState): string {
  return `${state.workspaceRoot ?? ''}:${state.currentBranch ?? ''}`;
}

function getStateWatcherKey(state: BranchContextExtensionState): string {
  const today = new Date();
  const dayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return `${state.workspaceRoot ?? ''}:${state.initialized ? '1' : '0'}:${dayKey}`;
}

function disposeAgentWatchers(): void {
  logger.debug(
    `[agent-sessions:indexer] disposing provider watchers count=${watcherDisposables.length}`,
  );
  for (const disposable of watcherDisposables) {
    disposable.dispose();
  }
  watcherDisposables = [];
}

function clearTimers(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = undefined;
  }
  clearFollowUpSyncTimers();
  clearRolloverTimer();
}

function clearFollowUpSyncTimers(): void {
  for (const timer of followUpSyncTimers) {
    clearTimeout(timer);
  }
  followUpSyncTimers = [];
}

function clearRolloverTimer(): void {
  if (rolloverTimer) {
    clearTimeout(rolloverTimer);
    rolloverTimer = undefined;
    logger.debug('[agent-sessions:indexer] rollover reset cleared');
  }
}
