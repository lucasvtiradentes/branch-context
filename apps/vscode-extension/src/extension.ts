import type * as vscode from 'vscode';
import { initializeAgentIndexer } from './features/agent-sessions/indexer';
import { initializeBranchContextWatcher } from './features/branch-context/watcher';
import { initializeContextFileUx } from './features/context-file-ux';
import { initializeContextsGroupBy } from './features/other-branches/views/contexts';
import { logger } from './shared/logger';
import { registerCommands } from './vscode/commands/register';
import { initializeGitDiffProvider } from './vscode/git-diff';
import { branchContextState } from './vscode/state';
import { initializeStatusBar } from './vscode/status-bar';
import { initializeTreeViews } from './vscode/views';

function initializeCore(context: vscode.ExtensionContext): void {
  logger.initialize();
  logger.info(`extension activated; log file reset at ${logger.getLogFilePath()}`);
  branchContextState.initialize(context);
  initializeContextsGroupBy(context);
}

function initializeUi(context: vscode.ExtensionContext): void {
  initializeGitDiffProvider(context);
  initializeContextFileUx(context);
  initializeStatusBar(context);
  initializeTreeViews(context);
  registerCommands(context);
}

function initializeRuntime(context: vscode.ExtensionContext): void {
  initializeBranchContextWatcher(context);
  initializeAgentIndexer(context);
}

export function activate(context: vscode.ExtensionContext): void {
  initializeCore(context);
  initializeUi(context);
  initializeRuntime(context);
}

export function deactivate(): void {
  logger.info('extension deactivated');
}
