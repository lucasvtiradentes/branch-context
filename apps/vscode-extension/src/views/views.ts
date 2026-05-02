import * as vscode from 'vscode';
import { viewIds } from '../constants';
import { initializeActiveAgentSessions } from '../core/agent-sessions/active';
import {
  createAgentSessionsProvider,
  getAgentSessionsViewDescription,
  initializeAgentSessionsViewState,
} from './branch-ai-sessions/agent-sessions';
import {
  createCurrentContextProvider,
  getCurrentContextViewDescription,
} from './branch-context/current-context';
import {
  createGitChangesProvider,
  getGitChangesViewDescription,
  initializeGitChangesMode,
} from './branch-git-changes/git-changes';
import { initializeTreeItemDecorations } from './items';
import { createContextsProvider } from './other-branches/contexts';
import { createTemplatesProvider } from './templates/templates';

export function initializeTreeViews(context: vscode.ExtensionContext): void {
  initializeTreeItemDecorations(context);
  initializeAgentSessionsViewState(context);
  initializeGitChangesMode(context);

  const currentContextProvider = createCurrentContextProvider();
  const agentSessionsProvider = createAgentSessionsProvider();
  initializeActiveAgentSessions(context, () => agentSessionsProvider.refresh());
  const gitChangesProvider = createGitChangesProvider();
  const providers = [
    [viewIds.currentContext, currentContextProvider],
    [viewIds.agentSessions, agentSessionsProvider],
    [viewIds.gitChanges, gitChangesProvider],
    [viewIds.contexts, createContextsProvider()],
    [viewIds.templates, createTemplatesProvider()],
  ] as const;

  for (const [viewId, provider] of providers) {
    context.subscriptions.push(provider);
    const view = vscode.window.createTreeView(viewId, { treeDataProvider: provider });
    context.subscriptions.push(view);
    if (viewId === viewIds.currentContext) {
      view.description = getCurrentContextViewDescription();
      context.subscriptions.push(
        provider.onDidChangeTreeData(() => {
          view.description = getCurrentContextViewDescription();
        }),
      );
    }

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
