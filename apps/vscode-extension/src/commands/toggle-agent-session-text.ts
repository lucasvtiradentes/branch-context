import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import { toggleAgentSessionTextMode } from '../tree-views/agent-sessions';

export function registerToggleAgentSessionTextCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.toggleAgentSessionText, async () => {
    try {
      await toggleAgentSessionTextMode(context);
      refreshBranchContextState();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
