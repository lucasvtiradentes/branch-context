import type * as vscode from 'vscode';
import { registerShowDetailsCommand } from './show-details';
import { registerSyncAgentsCommand } from './sync-agents';

export function registerInternalCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerShowDetailsCommand(), registerSyncAgentsCommand());
}
