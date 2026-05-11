import { syncAgentSessions, syncAllAgentSessions } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { branchContextState } from '../../../vscode/state';

export function registerSyncAgentsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.syncAgents, () => {
    const state = branchContextState.get();
    if (!state.workspaceRoot || !state.initialized) {
      return;
    }

    syncAgentSessions(state.workspaceRoot);
    branchContextState.refresh();
  });
}

export function registerSyncAllAgentSessionsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.syncAllAgentSessions, async () => {
    const state = branchContextState.get();
    if (!state.workspaceRoot || !state.initialized) {
      void vscode.window.showWarningMessage(`${APP_NAME} is not initialized in this workspace`);
      return;
    }
    const workspaceRoot = state.workspaceRoot;

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${APP_NAME}: Syncing branch AI sessions`,
      },
      () => Promise.resolve(syncAllAgentSessions(workspaceRoot)),
    );

    if (!result.ok) {
      void vscode.window.showWarningMessage(`${APP_NAME}: ${result.message}`);
      return;
    }

    branchContextState.refresh();
    void vscode.window.showInformationMessage(
      `${APP_NAME}: synced ${result.sessionCount} sessions across ${result.branches.length} branches`,
    );
  });
}
