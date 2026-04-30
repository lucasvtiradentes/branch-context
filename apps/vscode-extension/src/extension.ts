import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerInternalCommands } from './commands/internal';
import { initializeBranchContextState } from './core/state';
import { initializeBranchContextWatcher } from './core/watcher';

function initializeCore(context: vscode.ExtensionContext): void {
  initializeBranchContextState(context);
}

function initializeUi(context: vscode.ExtensionContext): void {
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
