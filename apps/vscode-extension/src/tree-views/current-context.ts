import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '@branch-context/core/constants';
import type { AgentSession } from '@branch-context/core/services/agents';
import * as vscode from 'vscode';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';
import { formatRelativeTime } from '../lib/format-relative-time';
import { createMessageNode, readDirectoryNodes, StateTreeProvider } from './items';

export function createCurrentContextProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    const contextRoot = getCurrentContextRoot(state);
    if (!contextRoot) {
      return [createMessageNode('No current context')];
    }

    return [
      createOverviewSection(state),
      createBranchContextSection(contextRoot),
      createAgentSessionsSection(state.agentSessions),
    ];
  });
}

function createOverviewSection(state: BranchContextExtensionState) {
  const currentContext = state.recentContexts.find((context) => context.current);
  const status = getStatusSummary(state);
  return {
    label: 'Overview',
    kind: 'group' as const,
    icon: new vscode.ThemeIcon('dashboard'),
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    children: () => [
      createOverviewItem('Branch', state.currentBranch ?? 'unknown', 'git-branch'),
      createOverviewItem('Base', state.status?.baseBranch ?? 'unknown', 'git-compare'),
      createOverviewItem('Status', status.label, status.icon),
      createOverviewItem(
        'Updated',
        formatRelativeTime(currentContext?.updatedAt ?? null),
        'history',
      ),
    ],
  };
}

function createBranchContextSection(contextRoot: string) {
  return {
    label: 'Branch Context',
    kind: 'group' as const,
    path: contextRoot,
    icon: new vscode.ThemeIcon('folder-library'),
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    children: () => readDirectoryNodes(contextRoot),
  };
}

function createAgentSessionsSection(sessions: AgentSession[]) {
  const groups = groupAgentSessions(sessions);
  const children =
    groups.length > 0
      ? groups.map(([provider, providerSessions]) => createProviderNode(provider, providerSessions))
      : [createMessageNode('No sessions')];

  return {
    label: 'Agent Sessions',
    kind: 'group' as const,
    description: String(sessions.length),
    icon: new vscode.ThemeIcon('comment-discussion'),
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    children: () => children,
  };
}

function createProviderNode(provider: AgentSession['provider'], sessions: AgentSession[]) {
  return {
    label: formatProviderName(provider),
    kind: 'group' as const,
    description: String(sessions.length),
    icon: new vscode.ThemeIcon(provider === 'codex' ? 'terminal' : 'sparkle'),
    children: () => sessions.map(createAgentSessionNode),
  };
}

function createAgentSessionNode(session: AgentSession) {
  const label = session.title || session.sessionId.slice(0, 8);
  const description = [formatRelativeTime(session.updatedAt ?? session.startedAt), session.model]
    .filter(Boolean)
    .join(' | ');
  const path = session.path ?? undefined;

  return {
    label,
    kind: 'agent' as const,
    path,
    description,
    tooltip: createAgentTooltip(session),
    icon: new vscode.ThemeIcon(session.provider === 'codex' ? 'terminal' : 'sparkle'),
    command: path
      ? {
          command: 'vscode.open',
          title: 'Open',
          arguments: [vscode.Uri.file(path)],
        }
      : undefined,
  };
}

function createOverviewItem(label: string, description: string, icon: string) {
  return {
    label,
    kind: 'overview' as const,
    description,
    tooltip: `${label}: ${description}`,
    icon: new vscode.ThemeIcon(icon),
  };
}

function getStatusSummary(state: BranchContextExtensionState) {
  if (state.status?.issues.some((issue) => issue.level === 'error')) {
    return { label: 'error', icon: 'error' };
  }

  if (state.status?.issues.some((issue) => issue.level === 'warning')) {
    return { label: 'warning', icon: 'warning' };
  }

  return { label: 'synced', icon: 'pass' };
}

function groupAgentSessions(sessions: AgentSession[]) {
  const groups = new Map<AgentSession['provider'], AgentSession[]>();
  for (const session of sessions) {
    const group = groups.get(session.provider) ?? [];
    group.push(session);
    groups.set(session.provider, group);
  }

  return Array.from(groups.entries()).sort(([left], [right]) => {
    return getProviderSort(left) - getProviderSort(right) || left.localeCompare(right);
  });
}

function getProviderSort(provider: AgentSession['provider']) {
  if (provider === 'codex') {
    return 0;
  }

  if (provider === 'claude') {
    return 1;
  }

  return 2;
}

function formatProviderName(provider: AgentSession['provider']) {
  if (provider === 'codex') {
    return 'Codex';
  }

  if (provider === 'claude') {
    return 'Claude Code';
  }

  return provider;
}

function createAgentTooltip(session: AgentSession) {
  return new vscode.MarkdownString(
    [
      markdownTooltipLine('provider', formatProviderName(session.provider)),
      markdownTooltipLine('branch', session.branch),
      markdownTooltipLine('scope', session.scope),
      markdownTooltipLine('model', session.model ?? 'unknown'),
      markdownTooltipLine('updated', formatRelativeTime(session.updatedAt ?? session.startedAt)),
    ].join('  \n'),
  );
}

function markdownTooltipLine(label: string, value: string) {
  return `**${label}:** ${escapeMarkdown(value)}`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

function getCurrentContextRoot(state: BranchContextExtensionState): string | null {
  if (!state.workspaceRoot) {
    return null;
  }

  const symlinkPath = join(state.workspaceRoot, DEFAULT_SYMLINK);
  if (existsSync(symlinkPath)) {
    return symlinkPath;
  }

  return state.currentContextDir;
}
