import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { formatError } from '../lib/format/error';
import { refreshBranchContextState } from '../state/state';
import { toggleGitChangesMode } from '../views/branch-git-changes/git-changes';

export function registerToggleGitChangesModeCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.toggleGitChangesMode, async () => {
    try {
      await toggleGitChangesMode(context);
      refreshBranchContextState();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
