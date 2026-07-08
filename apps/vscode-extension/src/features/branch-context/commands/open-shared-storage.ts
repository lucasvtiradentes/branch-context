import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { logger } from '../../../shared/logger';
import { branchContextState } from '../../../vscode/state';

export function registerOpenSharedStorageCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openSharedStorage, openSharedStorage);
}

async function openSharedStorage(): Promise<void> {
  try {
    const state = branchContextState.get();
    const sharedPath = state.status?.sharedPath;
    if (state.status?.mode !== 'shared' || !sharedPath) {
      return;
    }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sharedPath), true);
  } catch (error) {
    logger.error(`open shared storage command error: ${logger.formatError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}
