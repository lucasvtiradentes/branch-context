import { gitCheckout, syncCurrentBranch } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { formatActionError } from '../../../shared/command-utils/helpers';
import { formatError } from '../../../shared/format/error';
import { logger } from '../../../shared/logger';
import { branchContextState } from '../../../vscode/state';

export function registerCheckoutBranchCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.checkoutBranch, checkoutBranch);
}

async function checkoutBranch(): Promise<void> {
  try {
    const state = branchContextState.get();
    if (!state.workspaceRoot || !state.status) {
      await vscode.window.showErrorMessage(`${APP_NAME}: no workspace folder open`);
      return;
    }

    const branches = Array.from(state.status.contexts.entries())
      .filter(([, info]) => info.local)
      .map(([branch]) => branch)
      .sort();
    const selected = await vscode.window.showQuickPick(branches, {
      title: 'Checkout Branch',
      placeHolder: state.currentBranch ?? 'Branch',
      ignoreFocusOut: true,
    });

    if (!selected || selected === state.currentBranch) {
      return;
    }

    const checkoutResult = gitCheckout(state.workspaceRoot, selected);
    if (checkoutResult.status !== 0) {
      await vscode.window.showErrorMessage(
        `${APP_NAME}: checkout failed: ${checkoutResult.stderr.trim() || checkoutResult.stdout.trim()}`,
      );
      return;
    }

    const syncResult = syncCurrentBranch(state.workspaceRoot, { sound: false });
    if (!syncResult.ok) {
      await vscode.window.showErrorMessage(formatActionError(syncResult));
      return;
    }

    branchContextState.refresh();
  } catch (error) {
    logger.error(`checkout branch command error: ${logger.formatError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}
