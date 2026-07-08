import { backupGlobalStorage } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { logger } from '../../../shared/logger';
import { branchContextState } from '../../../vscode/state';

export function registerBackupCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.backup, async () => {
    try {
      const state = branchContextState.get();
      if (!state.workspaceRoot) {
        await vscode.window.showErrorMessage(`${APP_NAME}: no workspace folder open`);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${APP_NAME}: backing up global storage`,
        },
        () => Promise.resolve(backupGlobalStorage(state.workspaceRoot ?? '')),
      );

      if (!result.ok) {
        await vscode.window.showErrorMessage(`${APP_NAME}: ${result.message}`);
        return;
      }

      branchContextState.refresh();
      await vscode.window.showInformationMessage(`${APP_NAME}: ${result.message}`);
    } catch (error) {
      logger.error(`backup command error: ${logger.formatError(error)}`);
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
