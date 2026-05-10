import { basename, dirname, join, sep as pathSeparator, relative } from 'node:path';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_SYMLINK,
  getCustomHooksDir,
  getHookPath,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  syncCurrentBranch,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { branchContextState } from '../../vscode/state';
import { getWorkspaceInfo } from '../../vscode/workspace';
import { consumeBranchContextRefreshSuppression } from './refresh-suppression';

let watcherDisposables: vscode.Disposable[] = [];
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingRefreshEventCount = 0;
let pendingRefreshLastEvent = 'none';
let pendingConfigChange = false;
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
        pendingConfigChange = false;
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
  for (const hookPath of getHookWatchPaths(workspace.workspaceRoot)) {
    registerFileWatcher(hookPath);
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
    ...getHookWatchPaths(workspace.workspaceRoot),
  ].join(':');
}

function getHookWatchPaths(workspaceRoot: string | null): string[] {
  if (!workspaceRoot) {
    return [];
  }

  const paths = new Set([
    join(workspaceRoot, '.git', 'config'),
    getHookPath(workspaceRoot, HOOK_POST_CHECKOUT, false),
    getHookPath(workspaceRoot, HOOK_POST_COMMIT, false),
  ]);

  if (getCustomHooksDir(workspaceRoot)) {
    paths.add(getHookPath(workspaceRoot, HOOK_POST_CHECKOUT, true));
    paths.add(getHookPath(workspaceRoot, HOOK_POST_COMMIT, true));
  }

  return [...paths];
}

function registerFileWatcher(path: string): void {
  registerWatcher(dirname(path), basename(path));
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
  pendingConfigChange ||= isConfigPath(uri.fsPath);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    const eventCount = pendingRefreshEventCount;
    const lastEvent = pendingRefreshLastEvent;
    const configChanged = pendingConfigChange;
    pendingRefreshEventCount = 0;
    pendingRefreshLastEvent = 'none';
    pendingConfigChange = false;
    logger.debug(`watcher refresh fired events=${eventCount} last=${lastEvent}`);
    const state = branchContextState.refresh();
    if (configChanged) {
      syncAfterConfigChange(state.workspaceRoot);
    }
  }, 100);
}

function isConfigPath(path: string): boolean {
  const workspace = getWorkspaceInfo();
  return workspace.workspaceRoot
    ? path === join(workspace.workspaceRoot, CONFIG_DIR, CONFIG_FILE)
    : false;
}

function syncAfterConfigChange(workspaceRoot: string | null): void {
  if (!workspaceRoot) {
    return;
  }

  const result = syncCurrentBranch(workspaceRoot, { sound: false });
  if (!result.ok) {
    logger.debug(`config change sync skipped: reason=${result.reason} message=${result.message}`);
    return;
  }

  logger.info(
    [
      'config change sync result:',
      `branch=${result.branch}`,
      `contextDir=${result.contextDir}`,
      `symlink=${result.symlinkResult}`,
    ].join(' '),
  );
  branchContextState.refresh();
}
