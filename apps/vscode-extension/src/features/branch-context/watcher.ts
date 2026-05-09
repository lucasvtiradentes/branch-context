import { sep as pathSeparator, relative } from 'node:path';
import { CONFIG_DIR, DEFAULT_SYMLINK } from '@branch-context/core';
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { branchContextState } from '../../vscode/state';
import { getWorkspaceInfo } from '../../vscode/workspace';
import { consumeBranchContextRefreshSuppression } from './refresh-suppression';

let watcherDisposables: vscode.Disposable[] = [];
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingRefreshEventCount = 0;
let pendingRefreshLastEvent = 'none';
let watcherKey: string | null = null;

export function initializeBranchContextWatcher(context: vscode.ExtensionContext): void {
  logger.info('watcher initialized');
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      logger.info('workspace folders changed');
      watcherKey = null;
      resetWatchers();
      branchContextState.refresh();
    }),
    branchContextState.onDidChange(() => {
      resetWatchers();
    }),
    {
      dispose: () => {
        resetWatchers();
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = undefined;
        }
        pendingRefreshEventCount = 0;
        pendingRefreshLastEvent = 'none';
      },
    },
  );

  resetWatchers();
}

function resetWatchers(): void {
  const workspace = getWorkspaceInfo();
  const nextWatcherKey = getWatcherKey(workspace);
  if (nextWatcherKey === watcherKey) {
    return;
  }
  watcherKey = nextWatcherKey;
  disposeWatchers();

  if (!workspace.workspaceRoot) {
    logger.debug('watcher reset skipped: no workspace');
    return;
  }

  logger.debug(`watcher reset: workspace=${workspace.workspaceRoot}`);
  for (const pattern of getWatchPatterns()) {
    registerWatcher(workspace.workspaceRoot, pattern);
  }
  for (const externalRoot of [workspace.branchesDir, workspace.templatesDir]) {
    if (externalRoot && isOutsideWorkspace(workspace.workspaceRoot, externalRoot)) {
      registerWatcher(externalRoot, '**');
    }
  }
}

function getWatchPatterns(): string[] {
  return [`${CONFIG_DIR}/**`, `${DEFAULT_SYMLINK}/**`];
}

function getWatcherKey(workspace: ReturnType<typeof getWorkspaceInfo>): string {
  return [
    workspace.workspaceRoot ?? '',
    workspace.branchesDir ?? '',
    workspace.templatesDir ?? '',
  ].join(':');
}

function registerWatcher(workspaceRoot: string, pattern: string): void {
  logger.debug(`watcher registered: workspace=${workspaceRoot} pattern=${pattern}`);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(workspaceRoot), pattern),
  );

  watcherDisposables.push(
    watcher,
    watcher.onDidCreate((uri) => scheduleRefresh('create', uri)),
    watcher.onDidChange((uri) => scheduleRefresh('change', uri)),
    watcher.onDidDelete((uri) => scheduleRefresh('delete', uri)),
  );
}

function isOutsideWorkspace(workspaceRoot: string, path: string): boolean {
  const relPath = relative(workspaceRoot, path);
  return relPath === '..' || relPath.startsWith(`..${pathSeparator}`);
}

function disposeWatchers(): void {
  if (watcherDisposables.length > 0) {
    logger.debug(`watcher disposed: count=${watcherDisposables.length}`);
  }
  for (const disposable of watcherDisposables) {
    disposable.dispose();
  }
  watcherDisposables = [];
}

function scheduleRefresh(event: string, uri: vscode.Uri): void {
  if (consumeBranchContextRefreshSuppression(uri.fsPath)) {
    logger.debug(`watcher event ignored: type=${event} path=${uri.fsPath}`);
    return;
  }

  pendingRefreshEventCount += 1;
  pendingRefreshLastEvent = `type=${event} path=${uri.fsPath}`;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    const eventCount = pendingRefreshEventCount;
    const lastEvent = pendingRefreshLastEvent;
    pendingRefreshEventCount = 0;
    pendingRefreshLastEvent = 'none';
    logger.debug(`watcher refresh fired events=${eventCount} last=${lastEvent}`);
    branchContextState.refresh();
  }, 100);
}
