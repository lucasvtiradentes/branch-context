import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState, openPath } from '../../../shared/command-utils/helpers';
import { formatError } from '../../../shared/format/error';

export function registerOpenCurrentContextCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openCurrentContext, async () => {
    try {
      const state = await getInitializedState();
      if (!state) {
        return;
      }

      if (!state.currentContextFile) {
        await vscode.window.showErrorMessage(
          `${APP_NAME}: no current context file. Run sync first.`,
        );
        return;
      }

      await openPath(state.currentContextFile);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
