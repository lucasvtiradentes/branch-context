import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerStatusCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.status, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: status`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
