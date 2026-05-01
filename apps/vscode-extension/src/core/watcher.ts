import { CONFIG_DIR, DEFAULT_SYMLINK } from '@branch-context/core/constants';
import * as vscode from 'vscode';
import { refreshBranchContextState } from './state';
import { getWorkspaceInfo } from './workspace';

let watcherDisposables: vscode.Disposable[] = [];
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export function initializeBranchContextWatcher(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
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
    return;
  }

  for (const pattern of getWatchPatterns()) {
    registerWatcher(workspace.workspaceRoot, pattern);
  }
}

function getWatchPatterns(): string[] {
  return [`${CONFIG_DIR}/**`, `${DEFAULT_SYMLINK}/**`];
}

function registerWatcher(workspaceRoot: string, pattern: string): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(workspaceRoot), pattern),
  );

  watcherDisposables.push(
    watcher,
    watcher.onDidCreate(scheduleRefresh),
    watcher.onDidChange(scheduleRefresh),
    watcher.onDidDelete(scheduleRefresh),
  );
}

function disposeWatchers(): void {
  for (const disposable of watcherDisposables) {
    disposable.dispose();
  }
  watcherDisposables = [];
}

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    refreshBranchContextState();
  }, 100);
}
