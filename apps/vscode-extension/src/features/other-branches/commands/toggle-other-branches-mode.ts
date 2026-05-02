import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';
import { toggleOtherBranchesViewMode } from '../views/contexts';

export function registerToggleOtherBranchesModeCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.toggleOtherBranchesMode, async () => {
    try {
      await toggleOtherBranchesViewMode(context);
      branchContextState.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
