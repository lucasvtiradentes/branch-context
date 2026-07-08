import { Config } from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { getInitializedState } from '../../../shared/command-utils/helpers';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';

export function registerToggleConfigCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.toggleSound, () => toggleConfigBoolean('sound')),
    vscode.commands.registerCommand(commandIds.toggleCommitDescription, () =>
      toggleConfigBoolean('commitDescription'),
    ),
  ];
}

async function toggleConfigBoolean(field: 'sound' | 'commitDescription'): Promise<void> {
  try {
    const state = await getInitializedState();
    if (!state?.workspaceRoot) {
      return;
    }

    const config = Config.load(state.workspaceRoot);
    config[field] = !config[field];
    config.save(state.workspaceRoot);
    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}
