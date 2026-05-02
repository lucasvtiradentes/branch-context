import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format/error';
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
