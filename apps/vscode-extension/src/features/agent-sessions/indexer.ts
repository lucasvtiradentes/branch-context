import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getClaudeProjectKey, syncAgentSessions } from '@branch-context/core';
import * as vscode from 'vscode';
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
  branchKey = getStateBranchKey(state);
  resetAgentWatchers(state);
  scheduleAgentSync();

  context.subscriptions.push(
    branchContextState.onDidChange((nextState) => {
      const nextBranchKey = getStateBranchKey(nextState);
      if (nextBranchKey !== branchKey) {
        branchKey = nextBranchKey;
        scheduleAgentSync();
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

  watcherKey = nextWatcherKey;
  disposeAgentWatchers();
  clearRolloverTimer();

  if (!state.workspaceRoot || !state.initialized) {
    return;
  }

  registerProviderWatchers(state.workspaceRoot);
  scheduleRolloverReset();
}

function registerProviderWatchers(workspaceRoot: string): void {
  const homeDir = homedir();
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
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(root), pattern),
  );

  watcherDisposables.push(
    watcher,
    watcher.onDidCreate(handleAgentSessionFileChange),
    watcher.onDidChange(handleAgentSessionFileChange),
    watcher.onDidDelete(scheduleAgentSync),
  );
}

function handleAgentSessionFileChange(uri: vscode.Uri): void {
  markAgentSessionFileActive(uri.fsPath);
  scheduleAgentSync();
  scheduleFollowUpAgentSyncs();
}

function scheduleAgentSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    syncCurrentAgentSessions();
  }, SYNC_DEBOUNCE_MS);
}

function syncCurrentAgentSessions(): void {
  const state = branchContextState.get();
  if (!state.workspaceRoot || !state.currentBranch || !state.initialized) {
    return;
  }

  syncAgentSessions(state.workspaceRoot);
}

function scheduleFollowUpAgentSyncs(): void {
  clearFollowUpSyncTimers();
  followUpSyncTimers = FOLLOW_UP_SYNC_DELAYS_MS.map((delay) =>
    setTimeout(() => {
      syncCurrentAgentSessions();
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
    scheduleAgentSync();
  }, nextDay.getTime() - now.getTime());
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
  }
}
