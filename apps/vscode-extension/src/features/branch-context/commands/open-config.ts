import { existsSync } from 'node:fs';
import { CONFIG_DIR } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState, openPath } from '../../../shared/command-utils/helpers';
import { formatError } from '../../../shared/format/error';

export function registerOpenConfigCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.openConfig, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.configPath) {
        return;
      }

      if (!existsSync(state.configPath)) {
        await vscode.window.showErrorMessage(`${APP_NAME}: no ${CONFIG_DIR} config found`);
        return;
      }

      await openPath(state.configPath);
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
