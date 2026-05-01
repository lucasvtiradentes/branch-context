import { gitDiff } from '@branch-context/core';
import type { BranchGitSummary } from '@branch-context/core/services/git-summary';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
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

      const diff = gitDiff(state.workspaceRoot, [`${baseBranch}...HEAD`])?.trim();
      const content = diff || `No changes against ${baseBranch}\n`;
      const document = await vscode.workspace.openTextDocument({
        language: 'diff',
        content,
      });
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}

function formatGitSummaryError(summary: BranchGitSummary) {
  if (!summary.ok && summary.reason === 'base_not_found') {
    return `${APP_NAME}: base branch not found: ${summary.baseBranch ?? 'unknown'}`;
  }

  return `${APP_NAME}: no base branch configured`;
}
