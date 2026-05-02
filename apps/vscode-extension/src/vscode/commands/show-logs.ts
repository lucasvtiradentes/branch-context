import * as vscode from 'vscode';
import { commandIds } from '../../constants';
import { logger } from '../../shared/logger';

export function registerShowLogsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.showLogs, async () => {
    logger.info('showLogs invoked');
    await logger.showLogs();
  });
}
