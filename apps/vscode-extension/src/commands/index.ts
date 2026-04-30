import type * as vscode from 'vscode';
import { registerApplyTemplateCommand } from './apply-template';
import { registerOpenConfigCommand } from './open-config';
import { registerOpenCurrentContextCommand } from './open-current-context';
import { registerRefreshViewsCommand } from './refresh-views';
import { registerSetBaseCommand } from './set-base';
import { registerStatusCommand } from './status';
import { registerSyncCommand } from './sync';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerOpenCurrentContextCommand(),
    registerSyncCommand(),
    registerStatusCommand(),
    registerSetBaseCommand(),
    registerApplyTemplateCommand(),
    registerOpenConfigCommand(),
    registerRefreshViewsCommand(),
  );
}
