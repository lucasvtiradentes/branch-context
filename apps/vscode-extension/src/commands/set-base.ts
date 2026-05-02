import { getCurrentBase, setCurrentBase } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format/error';
import { formatActionError, getInitializedState } from './helpers';

export function registerSetBaseCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.setBase, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.workspaceRoot) {
        return;
      }

      const current = getCurrentBase(state.workspaceRoot);
      if (!current.ok) {
        await vscode.window.showErrorMessage(formatActionError(current));
        return;
      }

      const baseBranch = await vscode.window.showInputBox({
        prompt: 'Base branch',
        value: current.ok ? current.baseBranch : '',
      });

      if (baseBranch == null) {
        return;
      }

      const trimmedBase = baseBranch.trim();
      if (!trimmedBase) {
        await vscode.window.showErrorMessage(`${APP_NAME}: base branch is required`);
        return;
      }

      const result = setCurrentBase(state.workspaceRoot, trimmedBase);
      if (!result.ok) {
        await vscode.window.showErrorMessage(formatActionError(result));
        return;
      }

      refreshBranchContextState();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: base set to '${result.baseBranch}' for '${result.branch}'`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
