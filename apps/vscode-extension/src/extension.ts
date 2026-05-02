import type * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { initializeContextFileUx } from './context-file-ux';
import { initializeAgentIndexer } from './core/agent-sessions/indexer';
import { initializeGitDiffProvider } from './core/git-diff';
import { getLogFilePath, initializeLogging, logger } from './core/logger';
import { initializeBranchContextState } from './state/state';
import { initializeStatusBar } from './status-bar/status-bar';
import { initializeContextsGroupBy } from './views/other-branches/contexts';
import { initializeTreeViews } from './views/views';
import { initializeBranchContextWatcher } from './watchers/branch-context';

function initializeCore(context: vscode.ExtensionContext): void {
  initializeLogging();
  logger.info(`extension activated; log file reset at ${getLogFilePath()}`);
  initializeBranchContextState(context);
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
