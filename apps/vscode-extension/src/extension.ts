import { add } from '@branch-context/core';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('branch-context.showSharedSum', () =>
    vscode.window.showInformationMessage(`Core sum: ${add(1, 2)}`),
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
