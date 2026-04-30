import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerRefreshViewsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.refreshViews, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: refresh views`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
