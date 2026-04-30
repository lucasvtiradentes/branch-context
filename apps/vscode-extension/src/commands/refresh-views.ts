import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';

export function registerRefreshViewsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.refreshViews, async () => {
    try {
      const state = refreshBranchContextState();
      const detail = state.initialized
        ? `${state.currentBranch ?? 'no branch'} (${state.recentContexts.length} contexts)`
        : 'not initialized';
      await vscode.window.showInformationMessage(`${APP_NAME}: refreshed ${detail}`);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
