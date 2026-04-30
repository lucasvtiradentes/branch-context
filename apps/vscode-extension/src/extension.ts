import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerInternalCommands } from './commands/internal';
import { initializeContextFileUx } from './context-file-ux';
import { initializeBranchContextState } from './core/state';
import { initializeBranchContextWatcher } from './core/watcher';
import { initializeStatusBar } from './status-bar';
import { initializeTreeViews } from './tree-views';

function initializeCore(context: vscode.ExtensionContext): void {
  initializeBranchContextState(context);
}

function initializeUi(context: vscode.ExtensionContext): void {
  initializeContextFileUx(context);
  initializeStatusBar(context);
  initializeTreeViews(context);
  registerCommands(context);
  registerInternalCommands(context);
}

function initializeRuntime(context: vscode.ExtensionContext): void {
  initializeBranchContextWatcher(context);
}

export function activate(context: vscode.ExtensionContext): void {
  initializeCore(context);
  initializeUi(context);
  initializeRuntime(context);
}

export function deactivate(): void {}
