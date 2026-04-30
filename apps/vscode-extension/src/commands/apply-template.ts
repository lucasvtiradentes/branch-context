import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';

export function registerApplyTemplateCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.applyTemplate, async () => {
    try {
      await vscode.window.showInformationMessage(`${APP_NAME}: apply template`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
