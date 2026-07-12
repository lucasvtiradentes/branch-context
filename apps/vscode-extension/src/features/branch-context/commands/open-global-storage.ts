import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { logger } from '../../../shared/logger';
import { branchContextState } from '../../../vscode/state';

export function registerOpenGlobalStorageCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openGlobalStorage, openGlobalStorage);
}

async function openGlobalStorage(): Promise<void> {
  try {
    const state = branchContextState.get();
    const globalPath = state.status?.globalPath;
    if (state.status?.mode !== 'global' || !globalPath) {
      return;
    }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globalPath), true);
  } catch (error) {
    logger.error(`open global storage command error: ${logger.formatError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}
