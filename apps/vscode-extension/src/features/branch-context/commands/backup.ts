import { execFile } from 'node:child_process';
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

      const command = state.cliCompatibility.command ?? 'bctx';
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${APP_NAME}: backing up shared storage`,
        },
        () => runBackup(command, state.workspaceRoot ?? undefined),
      );
      branchContextState.refresh();
      await vscode.window.showInformationMessage(`${APP_NAME}: backup finished`);
    } catch (error) {
      logger.error(`backup command error: ${logger.formatError(error)}`);
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}

function runBackup(command: string, cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, ['backup'], { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || stdout.trim() || error.message));
        return;
      }

      resolve();
    });
  });
}
