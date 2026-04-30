import { existsSync } from 'node:fs';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format-error';
import { getInitializedState, openPath } from './helpers';

export function registerOpenConfigCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openConfig, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.configPath) {
        return;
      }

      if (!existsSync(state.configPath)) {
        await vscode.window.showErrorMessage(`${APP_NAME}: no .bctx config found`);
        return;
      }

      await openPath(state.configPath);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
