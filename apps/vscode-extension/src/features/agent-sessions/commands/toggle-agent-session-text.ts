import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/lib/format/error';
import { branchContextState } from '../../../vscode/state';
import { toggleAgentSessionTextMode } from '../views/agent-sessions';

export function registerToggleAgentSessionTextCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.toggleAgentSessionText, async () => {
    try {
      await toggleAgentSessionTextMode(context);
      branchContextState.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
