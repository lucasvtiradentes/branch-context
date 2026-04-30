import type * as vscode from 'vscode';
import { registerShowDetailsCommand } from './show-details';

export function registerInternalCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerShowDetailsCommand());
}
