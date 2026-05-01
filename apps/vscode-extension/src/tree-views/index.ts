import * as vscode from 'vscode';
import { viewIds } from '../constants';
import {
  createAgentSessionsProvider,
  getAgentSessionsViewDescription,
  initializeAgentSessionsViewState,
} from './agent-sessions';
import { createContextsProvider } from './contexts';
import { createCurrentContextProvider } from './current-context';
import {
  createGitChangesProvider,
  getGitChangesViewDescription,
  initializeGitChangesMode,
} from './git-changes';
import { createTemplatesProvider } from './templates';

export function initializeTreeViews(context: vscode.ExtensionContext): void {
  initializeAgentSessionsViewState(context);
  initializeGitChangesMode(context);

  const agentSessionsProvider = createAgentSessionsProvider();
  const gitChangesProvider = createGitChangesProvider();
  const providers = [
    [viewIds.currentContext, createCurrentContextProvider()],
    [viewIds.agentSessions, agentSessionsProvider],
    [viewIds.gitChanges, gitChangesProvider],
    [viewIds.contexts, createContextsProvider()],
    [viewIds.templates, createTemplatesProvider()],
  ] as const;

  for (const [viewId, provider] of providers) {
    context.subscriptions.push(provider);
    const view = vscode.window.createTreeView(viewId, { treeDataProvider: provider });
    context.subscriptions.push(view);
    if (viewId === viewIds.agentSessions) {
      view.description = getAgentSessionsViewDescription();
      context.subscriptions.push(
        provider.onDidChangeTreeData(() => {
          view.description = getAgentSessionsViewDescription();
        }),
      );
    }

    if (viewId === viewIds.gitChanges) {
      view.description = getGitChangesViewDescription();
      context.subscriptions.push(
        provider.onDidChangeTreeData(() => {
          view.description = getGitChangesViewDescription();
        }),
      );
    }
  }
}
