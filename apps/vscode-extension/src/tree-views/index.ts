import * as vscode from 'vscode';
import { viewIds } from '../constants';
import { createArchivedContextsProvider } from './archived-contexts';
import { createConfigProvider } from './config';
import { createCurrentContextProvider } from './current-context';
import { createRecentContextsProvider } from './recent-contexts';
import { createTemplatesProvider } from './templates';

export function initializeTreeViews(context: vscode.ExtensionContext): void {
  const providers = [
    [viewIds.currentContext, createCurrentContextProvider()],
    [viewIds.recentContexts, createRecentContextsProvider()],
    [viewIds.archivedContexts, createArchivedContextsProvider()],
    [viewIds.templates, createTemplatesProvider()],
    [viewIds.config, createConfigProvider()],
  ] as const;

  for (const [viewId, provider] of providers) {
    context.subscriptions.push(provider);
    context.subscriptions.push(vscode.window.registerTreeDataProvider(viewId, provider));
  }
}
