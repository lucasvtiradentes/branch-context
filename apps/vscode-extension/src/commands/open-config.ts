import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerOpenConfigCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openConfig, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: open config`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
