import { syncAgentSessions } from '@branch-context/core/services/agents';
import * as vscode from 'vscode';
import { commandIds } from '../../constants';
import { getBranchContextState, refreshBranchContextState } from '../../core/state';

export function registerSyncAgentsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.syncAgents, () => {
    const state = getBranchContextState();
    if (!state.workspaceRoot || !state.initialized) {
      return;
    }

    syncAgentSessions(state.workspaceRoot);
    refreshBranchContextState();
  });
}
