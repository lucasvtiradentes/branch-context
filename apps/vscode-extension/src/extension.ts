import { CLI_NAME } from '@branch-context/core/constants';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('branch-context.showSharedSum', () =>
    vscode.window.showInformationMessage(`${CLI_NAME} workspace package loaded`),
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
