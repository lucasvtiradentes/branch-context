import { type BranchGitSummary, BranchGitSummaryErrorReason } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { openBranchChanges } from '../core/git-diff';
import { formatError } from '../lib/format-error';
import { getInitializedState } from './helpers';

export function registerReviewDiffCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.reviewDiff, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.workspaceRoot) {
        return;
      }

      const baseBranch = state.status?.baseBranch;
      if (!baseBranch) {
        await vscode.window.showErrorMessage(`${APP_NAME}: no base branch configured`);
        return;
      }

      if (state.gitSummary && !state.gitSummary.ok) {
        await vscode.window.showErrorMessage(formatGitSummaryError(state.gitSummary));
        return;
      }

      const opened = await openBranchChanges(
        state.workspaceRoot,
        baseBranch,
        state.gitSummary?.changedFiles ?? [],
      );
      if (!opened) {
        await vscode.window.showInformationMessage(`${APP_NAME}: no changes against ${baseBranch}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}

function formatGitSummaryError(summary: BranchGitSummary) {
  if (!summary.ok && summary.reason === BranchGitSummaryErrorReason.BaseNotFound) {
    return `${APP_NAME}: base branch not found: ${summary.baseBranch ?? 'unknown'}`;
  }

  return `${APP_NAME}: no base branch configured`;
}
