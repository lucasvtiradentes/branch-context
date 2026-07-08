import * as vscode from 'vscode';
import { viewIds } from '../constants';
import { initializeActiveAgentSessions } from '../features/agent-sessions/active';
import {
  createAgentSessionsProvider,
  getAgentSessionsViewDescription,
  initializeAgentSessionsViewState,
  saveAgentSessionGroupCollapseState,
} from '../features/agent-sessions/views/agent-sessions';
import {
  createGitChangesProvider,
  getGitChangesViewDescription,
  initializeGitChangesMode,
  saveGitChangesGroupCollapseState,
} from '../features/git-changes/views/git-changes';
import {
  createContextsProvider,
  getOtherBranchesViewDescription,
  saveContextsGroupCollapseState,
} from '../features/other-branches/views/contexts';
import { createTemplatesProvider } from '../features/templates/views/templates';
import { initializeTreeItemDecorations } from '../shared/tree-items';

export function initializeTreeViews(context: vscode.ExtensionContext): void {
  initializeTreeItemDecorations(context);
  initializeAgentSessionsViewState(context);
  initializeGitChangesMode(context);

  const agentSessionsProvider = createAgentSessionsProvider();
  initializeActiveAgentSessions(context, () => agentSessionsProvider.refresh());
  const gitChangesProvider = createGitChangesProvider();
  const contextsProvider = createContextsProvider();
  const providers = [
    [viewIds.agentSessions, agentSessionsProvider],
    [viewIds.gitChanges, gitChangesProvider],
    [viewIds.contexts, contextsProvider],
    [viewIds.templates, createTemplatesProvider(context)],
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
        view.onDidCollapseElement((event) => {
          void saveAgentSessionGroupCollapseState(context, event.element, true);
        }),
        view.onDidExpandElement((event) => {
          void saveAgentSessionGroupCollapseState(context, event.element, false);
        }),
      );
    }

    if (viewId === viewIds.gitChanges) {
      view.description = getGitChangesViewDescription();
      context.subscriptions.push(
        provider.onDidChangeTreeData(() => {
          view.description = getGitChangesViewDescription();
        }),
        view.onDidCollapseElement((event) => {
          void saveGitChangesGroupCollapseState(context, event.element, true);
        }),
        view.onDidExpandElement((event) => {
          void saveGitChangesGroupCollapseState(context, event.element, false);
        }),
      );
    }

    if (viewId === viewIds.contexts) {
      view.description = getOtherBranchesViewDescription();
      context.subscriptions.push(
        provider.onDidChangeTreeData(() => {
          view.description = getOtherBranchesViewDescription();
        }),
        view.onDidCollapseElement((event) => {
          void saveContextsGroupCollapseState(context, event.element, true);
        }),
        view.onDidExpandElement((event) => {
          void saveContextsGroupCollapseState(context, event.element, false);
        }),
      );
    }
  }
}
