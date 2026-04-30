import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerSetBaseCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.setBase, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: set base`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
