import { CONFIG_DIR, DEFAULT_SYMLINK } from '@branch-context/core/constants';
import * as vscode from 'vscode';
import { logger } from '../lib/logging';
import { refreshBranchContextState } from './state';
import { getWorkspaceInfo } from './workspace';

let watcherDisposables: vscode.Disposable[] = [];
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export function initializeBranchContextWatcher(context: vscode.ExtensionContext): void {
  logger.info('watcher initialized');
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      logger.info('workspace folders changed');
      resetWatchers();
      refreshBranchContextState();
    }),
    {
      dispose: () => {
        resetWatchers();
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = undefined;
        }
      },
    },
  );

  resetWatchers();
}

function resetWatchers(): void {
  disposeWatchers();

  const workspace = getWorkspaceInfo();
  if (!workspace.workspaceRoot) {
    logger.debug('watcher reset skipped: no workspace');
    return;
  }

  logger.debug(`watcher reset: workspace=${workspace.workspaceRoot}`);
  for (const pattern of getWatchPatterns()) {
    registerWatcher(workspace.workspaceRoot, pattern);
  }
}

function getWatchPatterns(): string[] {
  return [`${CONFIG_DIR}/**`, `${DEFAULT_SYMLINK}/**`];
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
  logger.debug(`watcher event: type=${event} path=${uri.fsPath}`);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    logger.debug('watcher refresh fired');
    refreshBranchContextState();
  }, 100);
}
