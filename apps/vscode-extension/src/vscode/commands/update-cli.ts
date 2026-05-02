import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../constants';
import { branchContextState } from '../state';

export function registerUpdateCliCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.updateCli, () => {
    const cli = branchContextState.get().cliCompatibility;
    const terminal = vscode.window.createTerminal(`${APP_NAME}: Update CLI`);
    terminal.show();
    terminal.sendText(cli.updateCommand, true);
  });
}
