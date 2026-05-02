import type { GitCommitSummary } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState } from '../../../shared/commands/helpers';
import { formatError } from '../../../shared/lib/format/error';
import { openCommitChanges } from '../../../vscode/git-diff';

export function registerOpenCommitDiffCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    commandIds.openCommitDiff,
    async (commit?: GitCommitSummary) => {
      try {
        const state = await getInitializedState();
        if (!state?.workspaceRoot || !commit) {
          return;
        }

        const opened = await openCommitChanges(state.workspaceRoot, commit);
        if (!opened) {
          await vscode.window.showInformationMessage(`${APP_NAME}: commit has no file changes`);
        }
      } catch (error) {
        await vscode.window.showErrorMessage(formatError(error));
      }
    },
  );
}
