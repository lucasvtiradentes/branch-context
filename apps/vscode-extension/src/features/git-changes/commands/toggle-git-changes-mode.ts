import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';
import { toggleGitChangesMode } from '../views/git-changes';

export function registerToggleGitChangesModeCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.toggleGitChangesMode, async () => {
    try {
      await toggleGitChangesMode(context);
      branchContextState.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
