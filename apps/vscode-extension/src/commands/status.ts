import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import { getInitializedState } from './helpers';

export function registerStatusCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.status, async () => {
    try {
      refreshBranchContextState();
      const state = await getInitializedState();
      if (!state?.status) {
        return;
      }

      const errors = state.status.issues.filter((issue) => issue.level === 'error').length;
      const warnings = state.status.issues.filter((issue) => issue.level === 'warning').length;
      await vscode.window.showInformationMessage(
        `${APP_NAME}: ${state.currentBranch ?? 'no branch'} | ${state.recentContexts.length} contexts | ${state.templates.length} templates | ${errors} errors | ${warnings} warnings`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
