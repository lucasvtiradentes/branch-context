import { syncCurrentBranch } from '@branch-context/core/services/actions';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import { formatActionError, getInitializedState } from './helpers';

export function registerSyncCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.sync, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.workspaceRoot) {
        return;
      }

      const result = syncCurrentBranch(state.workspaceRoot, { sound: false });
      if (!result.ok) {
        await vscode.window.showErrorMessage(formatActionError(result));
        return;
      }

      refreshBranchContextState();
      const status =
        result.createResult === 'created_from_template'
          ? 'created from template'
          : result.createResult === 'created_empty'
            ? 'created'
            : 'synced';
      await vscode.window.showInformationMessage(
        `${APP_NAME}: ${status} '${result.branch}' (${result.updates.length} tag updates)`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
