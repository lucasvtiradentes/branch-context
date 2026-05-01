import type * as vscode from 'vscode';
import { registerApplyTemplateCommand } from './apply-template';
import { registerContextActionCommands } from './context-actions';
import { registerGroupContextsCommand } from './group-contexts';
import { registerOpenConfigCommand } from './open-config';
import { registerOpenCurrentContextCommand } from './open-current-context';
import { registerOpenCurrentContextFolderCommand } from './open-current-context-folder';
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
    registerOpenCurrentContextFolderCommand(),
    registerGroupContextsCommand(context),
    ...registerContextActionCommands(),
  );
}
