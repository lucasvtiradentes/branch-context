import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '@branch-context/core/constants';
import type { AgentSession } from '@branch-context/core/services/agents';
import type {
  BranchGitSummary,
  GitChangedFileSummary,
  GitCommitSummary,
} from '@branch-context/core/services/git-summary';
import * as vscode from 'vscode';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';
import { formatRelativeTime } from '../lib/format-relative-time';
import {
  type BranchContextTreeNode,
  createMessageNode,
  readDirectoryNodes,
  StateTreeProvider,
} from './items';

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
      createChangedFilesSection(state),
      createCommitsSection(state.gitSummary),
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

function createChangedFilesSection(state: BranchContextExtensionState) {
  const gitSummary = state.gitSummary;
  const children = getGitSummaryChildren(gitSummary, (summary) =>
    summary.changedFiles.map((file) => createChangedFileNode(state.workspaceRoot, file)),
  );

  return {
    label: 'Changed Files',
    kind: 'group' as const,
    description: gitSummary?.ok ? String(gitSummary.changedFiles.length) : undefined,
    icon: new vscode.ThemeIcon('diff'),
    children: () => children,
  };
}

function createCommitsSection(gitSummary: BranchGitSummary | null) {
  const children = getGitSummaryChildren(gitSummary, (summary) =>
    summary.commits.map(createCommitNode),
  );

  return {
    label: 'Commits',
    kind: 'group' as const,
    description: gitSummary?.ok ? String(gitSummary.commits.length) : undefined,
    icon: new vscode.ThemeIcon('git-commit'),
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

function createChangedFileNode(workspaceRoot: string | null, file: GitChangedFileSummary) {
  const filePath = workspaceRoot ? join(workspaceRoot, file.path) : undefined;
  const fileExists = filePath ? existsSync(filePath) : false;

  return {
    label: file.path,
    kind: 'file' as const,
    path: fileExists ? filePath : undefined,
    description: `${file.status} | +${formatStat(file.additions)} -${formatStat(file.deletions)}`,
    tooltip: createChangedFileTooltip(file),
    icon: new vscode.ThemeIcon(getChangedFileIcon(file.status)),
    command:
      fileExists && filePath
        ? {
            command: 'vscode.open',
            title: 'Open',
            arguments: [vscode.Uri.file(filePath)],
          }
        : undefined,
  };
}

function createCommitNode(commit: GitCommitSummary) {
  return {
    label: commit.subject,
    kind: 'overview' as const,
    description: `${commit.shortHash} | ${formatRelativeTime(commit.authoredAt)}`,
    tooltip: createCommitTooltip(commit),
    icon: new vscode.ThemeIcon('git-commit'),
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

function getGitSummaryChildren(
  gitSummary: BranchGitSummary | null,
  createChildren: (summary: Extract<BranchGitSummary, { ok: true }>) => BranchContextTreeNode[],
) {
  if (!gitSummary) {
    return [createMessageNode('No Git summary')];
  }

  if (!gitSummary.ok) {
    return [createMessageNode(formatGitSummaryError(gitSummary))];
  }

  const children = createChildren(gitSummary);
  return children.length > 0 ? children : [createMessageNode('No changes')];
}

function formatGitSummaryError(gitSummary: Extract<BranchGitSummary, { ok: false }>) {
  if (gitSummary.reason === 'base_not_found') {
    return `Base not found: ${gitSummary.baseBranch ?? 'unknown'}`;
  }

  return 'No base branch';
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

function getChangedFileIcon(status: string) {
  if (status === 'A') {
    return 'diff-added';
  }

  if (status === 'D') {
    return 'diff-removed';
  }

  if (status === 'R') {
    return 'diff-renamed';
  }

  return 'diff-modified';
}

function formatStat(value: number | null) {
  return value == null ? '-' : String(value);
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

function createChangedFileTooltip(file: GitChangedFileSummary) {
  const lines = [
    markdownTooltipLine('file', file.path),
    markdownTooltipLine('status', file.status),
    markdownTooltipLine('additions', formatStat(file.additions)),
    markdownTooltipLine('deletions', formatStat(file.deletions)),
  ];

  if (file.oldPath) {
    lines.push(markdownTooltipLine('old file', file.oldPath));
  }

  return new vscode.MarkdownString(lines.join('  \n'));
}

function createCommitTooltip(commit: GitCommitSummary) {
  return new vscode.MarkdownString(
    [
      markdownTooltipLine('commit', commit.shortHash),
      markdownTooltipLine('subject', commit.subject),
      markdownTooltipLine('authored', formatRelativeTime(commit.authoredAt)),
    ].join('  \n'),
  );
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
