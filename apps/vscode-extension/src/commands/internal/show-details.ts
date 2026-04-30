import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../constants';
import { refreshBranchContextState } from '../../core/state';
import { formatError } from '../../lib/format-error';

export function registerShowDetailsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.showDetails, async () => {
    try {
      const state = refreshBranchContextState();
      if (!state.workspaceRoot) {
        await vscode.window.showInformationMessage(`${APP_NAME}: no workspace folder open`);
        return;
      }

      if (!state.initialized || !state.status) {
        await vscode.window.showInformationMessage(`${APP_NAME}: no .bctx config found`);
        return;
      }

      const errors = state.status.issues.filter((issue) => issue.level === 'error').length;
      const warnings = state.status.issues.filter((issue) => issue.level === 'warning').length;
      await vscode.window.showInformationMessage(
        `${APP_NAME}: ${state.currentBranch ?? 'no branch'} | base ${state.status.baseBranch ?? 'n/a'} | ${state.recentContexts.length} contexts | ${state.archivedContexts.length} archived | ${errors} errors | ${warnings} warnings`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
