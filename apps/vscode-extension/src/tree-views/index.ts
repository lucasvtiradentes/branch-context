import * as vscode from 'vscode';
import { viewIds } from '../constants';
import { createContextsProvider } from './contexts';
import { createCurrentContextProvider } from './current-context';
import { createTemplatesProvider } from './templates';

export function initializeTreeViews(context: vscode.ExtensionContext): void {
  const providers = [
    [viewIds.currentContext, createCurrentContextProvider()],
    [viewIds.contexts, createContextsProvider()],
    [viewIds.templates, createTemplatesProvider()],
  ] as const;

  for (const [viewId, provider] of providers) {
    context.subscriptions.push(provider);
    context.subscriptions.push(vscode.window.registerTreeDataProvider(viewId, provider));
  }
}
