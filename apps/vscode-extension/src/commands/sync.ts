import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerSyncCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.sync, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: sync`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
