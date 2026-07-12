import { syncAgentSessions } from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
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
