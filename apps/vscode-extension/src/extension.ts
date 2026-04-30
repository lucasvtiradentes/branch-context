import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerInternalCommands } from './commands/internal';

function initializeCore(_context: vscode.ExtensionContext): void {}

function initializeUi(context: vscode.ExtensionContext): void {
  registerCommands(context);
  registerInternalCommands(context);
}

function initializeRuntime(_context: vscode.ExtensionContext): void {}

export function activate(context: vscode.ExtensionContext): void {
  initializeCore(context);
  initializeUi(context);
  initializeRuntime(context);
}

export function deactivate(): void {}
