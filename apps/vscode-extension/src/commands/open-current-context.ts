import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerOpenCurrentContextCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openCurrentContext, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: open current context`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
