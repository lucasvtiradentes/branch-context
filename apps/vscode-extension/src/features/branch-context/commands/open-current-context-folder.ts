import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState, openExternalFolder } from '../../../shared/commands/helpers';
import { formatError } from '../../../shared/lib/format/error';

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
