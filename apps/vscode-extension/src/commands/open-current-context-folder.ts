import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format/error';
import { getInitializedState, openExternalFolder } from './helpers';

export function registerOpenCurrentContextFolderCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openCurrentContextFolder, async () => {
    try {
      const state = await getInitializedState();
      if (!state) {
        return;
      }

      if (!state.currentContextDir) {
        await vscode.window.showErrorMessage(
          `${APP_NAME}: no current context folder. Run sync first.`,
        );
        return;
      }

      await openExternalFolder(state.currentContextDir);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
