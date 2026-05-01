import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BranchGitSummary,
  GitChangedFileSummary,
  GitCommitSummary,
} from '@branch-context/core/services/git-summary';
import * as vscode from 'vscode';
import { commandIds, contextKeys } from '../constants';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';
import { formatRelativeTime } from '../lib/format-relative-time';
import {
  type BranchContextTreeNode,
  createGroupNode,
  createMessageNode,
  StateTreeProvider,
} from './items';

const gitChangesModeValues = ['files', 'commits'] as const;
const gitChangedFilesGroupByValues = ['flat', 'changeType'] as const;
const gitCommitsGroupByValues = ['flat', 'date', 'author'] as const;
const gitChangesModeWorkspaceKey = 'gitChanges.mode';
const gitChangedFilesGroupByWorkspaceKey = 'gitChanges.filesGroupBy';
const gitCommitsGroupByWorkspaceKey = 'gitChanges.commitsGroupBy';

type GitChangesMode = (typeof gitChangesModeValues)[number];
export type GitChangedFilesGroupBy = (typeof gitChangedFilesGroupByValues)[number];
export type GitCommitsGroupBy = (typeof gitCommitsGroupByValues)[number];

let gitChangesMode: GitChangesMode = 'files';
let gitChangedFilesGroupBy: GitChangedFilesGroupBy = 'flat';
let gitCommitsGroupBy: GitCommitsGroupBy = 'flat';

export function initializeGitChangesMode(context: vscode.ExtensionContext): void {
  const savedMode = context.workspaceState.get<unknown>(gitChangesModeWorkspaceKey);
  if (isGitChangesMode(savedMode)) {
    gitChangesMode = savedMode;
  }

  const savedChangedFilesGroupBy = context.workspaceState.get<unknown>(
    gitChangedFilesGroupByWorkspaceKey,
  );
  if (isGitChangedFilesGroupBy(savedChangedFilesGroupBy)) {
    gitChangedFilesGroupBy = savedChangedFilesGroupBy;
  }

  const savedCommitsGroupBy = context.workspaceState.get<unknown>(gitCommitsGroupByWorkspaceKey);
  if (isGitCommitsGroupBy(savedCommitsGroupBy)) {
    gitCommitsGroupBy = savedCommitsGroupBy;
  }

  updateGitChangesModeContext();
}

export function getGitChangesViewDescription(): string {
  return gitChangesMode === 'files' ? 'changed files' : 'commits';
}

export function getGitChangedFilesGroupBy(): GitChangedFilesGroupBy {
  return gitChangedFilesGroupBy;
}

export function getGitCommitsGroupBy(): GitCommitsGroupBy {
  return gitCommitsGroupBy;
}

export async function saveGitChangedFilesGroupBy(
  context: vscode.ExtensionContext,
  nextGroupBy: GitChangedFilesGroupBy,
): Promise<void> {
  gitChangedFilesGroupBy = nextGroupBy;
  await context.workspaceState.update(gitChangedFilesGroupByWorkspaceKey, nextGroupBy);
}

export async function saveGitCommitsGroupBy(
  context: vscode.ExtensionContext,
  nextGroupBy: GitCommitsGroupBy,
): Promise<void> {
  gitCommitsGroupBy = nextGroupBy;
  await context.workspaceState.update(gitCommitsGroupByWorkspaceKey, nextGroupBy);
}

export async function toggleGitChangesMode(
  context: vscode.ExtensionContext,
): Promise<GitChangesMode> {
  const nextMode = gitChangesMode === 'files' ? 'commits' : 'files';
  gitChangesMode = nextMode;
  await context.workspaceState.update(gitChangesModeWorkspaceKey, nextMode);
  updateGitChangesModeContext();
  return nextMode;
}

export function createGitChangesProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    return gitChangesMode === 'files'
      ? createChangedFileNodes(state)
      : createCommitNodes(state.gitSummary);
  });
}

function isGitChangesMode(value: unknown): value is GitChangesMode {
  return typeof value === 'string' && (gitChangesModeValues as readonly string[]).includes(value);
}

function isGitChangedFilesGroupBy(value: unknown): value is GitChangedFilesGroupBy {
  return (
    typeof value === 'string' && (gitChangedFilesGroupByValues as readonly string[]).includes(value)
  );
}

function updateGitChangesModeContext(): void {
  void vscode.commands.executeCommand('setContext', contextKeys.gitChangesMode, gitChangesMode);
}

function isGitCommitsGroupBy(value: unknown): value is GitCommitsGroupBy {
  return (
    typeof value === 'string' && (gitCommitsGroupByValues as readonly string[]).includes(value)
  );
}

function createChangedFileNodes(state: BranchContextExtensionState) {
  return getGitSummaryChildren(state.gitSummary, (summary) =>
    groupChangedFileNodes(state.workspaceRoot, summary.changedFiles),
  );
}

function createCommitNodes(gitSummary: BranchGitSummary | null) {
  return getGitSummaryChildren(gitSummary, (summary) => groupCommitNodes(summary.commits));
}

function groupCommitNodes(commits: GitCommitSummary[]) {
  if (gitCommitsGroupBy === 'date') {
    return createOrderedCommitGroups(commits, ['Today', 'This week', 'Older'], getCommitDateGroup);
  }

  if (gitCommitsGroupBy === 'author') {
    return createSortedCommitGroups(commits, (commit) => commit.authorName);
  }

  return commits.map(createCommitNode);
}

function groupChangedFileNodes(workspaceRoot: string | null, files: GitChangedFileSummary[]) {
  if (gitChangedFilesGroupBy !== 'changeType') {
    return files.map((file) => createChangedFileNode(workspaceRoot, file));
  }

  return [
    createChangedFileGroup(workspaceRoot, files, 'Added', ['A'], getChangedFileIcon('A')),
    createChangedFileGroup(workspaceRoot, files, 'Modified', ['M'], getChangedFileIcon('M')),
    createChangedFileGroup(workspaceRoot, files, 'Renamed', ['R'], getChangedFileIcon('R')),
    createChangedFileGroup(workspaceRoot, files, 'Deleted', ['D'], getChangedFileIcon('D')),
    createChangedFileGroup(workspaceRoot, files, 'Other', [], new vscode.ThemeIcon('diff')),
  ].filter((group) => group.children?.().length);
}

function createChangedFileGroup(
  workspaceRoot: string | null,
  files: GitChangedFileSummary[],
  label: string,
  statuses: string[],
  icon: vscode.TreeItem['iconPath'],
) {
  const groupedFiles = files.filter((file) =>
    statuses.length > 0
      ? statuses.includes(file.status)
      : !['A', 'M', 'R', 'D'].includes(file.status),
  );

  return createGroupNode(
    label,
    groupedFiles.map((file) =>
      createChangedFileNode(workspaceRoot, file, {
        includeStatusInDescription: false,
        showStatusIcon: false,
      }),
    ),
    {
      description: String(groupedFiles.length),
      icon,
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    },
  );
}

function createOrderedCommitGroups(
  commits: GitCommitSummary[],
  labels: string[],
  getLabel: (commit: GitCommitSummary) => string,
) {
  return labels
    .map((label) =>
      createGroupNode(
        label,
        commits.filter((commit) => getLabel(commit) === label).map(createCommitNode),
      ),
    )
    .filter((group) => group.children?.().length);
}

function createSortedCommitGroups(
  commits: GitCommitSummary[],
  getLabel: (commit: GitCommitSummary) => string,
) {
  const groups = new Map<string, GitCommitSummary[]>();
  for (const commit of commits) {
    const label = getLabel(commit);
    const group = groups.get(label) ?? [];
    group.push(commit);
    groups.set(label, group);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedCommits]) =>
      createGroupNode(label, groupedCommits.map(createCommitNode), String(groupedCommits.length)),
    );
}

function getCommitDateGroup(commit: GitCommitSummary) {
  const authoredAt = Date.parse(commit.authoredAt);
  if (Number.isNaN(authoredAt)) {
    return 'Older';
  }

  const ageMs = Date.now() - authoredAt;
  if (ageMs < 24 * 60 * 60 * 1000) {
    return 'Today';
  }

  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return 'This week';
  }

  return 'Older';
}

type ChangedFileNodeOptions = {
  includeStatusInDescription?: boolean;
  showStatusIcon?: boolean;
};

function createChangedFileNode(
  workspaceRoot: string | null,
  file: GitChangedFileSummary,
  options: ChangedFileNodeOptions = {},
) {
  const filePath = workspaceRoot ? join(workspaceRoot, file.path) : undefined;
  const fileExists = filePath ? existsSync(filePath) : false;
  const includeStatusInDescription = options.includeStatusInDescription ?? false;
  const showStatusIcon = options.showStatusIcon ?? true;

  return {
    label: file.path,
    kind: 'file' as const,
    path: fileExists ? filePath : undefined,
    description: formatChangedFileDescription(file, includeStatusInDescription),
    tooltip: createChangedFileTooltip(file),
    icon: showStatusIcon ? getChangedFileIcon(file.status) : undefined,
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

function formatChangedFileDescription(
  file: GitChangedFileSummary,
  includeStatusInDescription: boolean,
) {
  const stats = `+${formatStat(file.additions)} -${formatStat(file.deletions)}`;
  return includeStatusInDescription ? `${file.status} | ${stats}` : stats;
}

function createCommitNode(commit: GitCommitSummary) {
  return {
    label: commit.subject,
    kind: 'commit' as const,
    description: formatRelativeTime(commit.authoredAt),
    tooltip: createCommitTooltip(commit),
    icon: new vscode.ThemeIcon('git-commit'),
    commit,
    contextValue: 'branchContext.commit',
    command: {
      command: commandIds.openCommitDiff,
      title: 'Open Commit Diff',
      arguments: [commit],
    },
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

function getChangedFileIcon(status: string) {
  const icon = getChangedFileLetterIcon(status);
  if (icon) {
    return icon;
  }

  if (status === 'A') {
    return new vscode.ThemeIcon('diff-added');
  }

  if (status === 'D') {
    return new vscode.ThemeIcon('diff-removed');
  }

  if (status === 'R') {
    return new vscode.ThemeIcon('diff-renamed');
  }

  return new vscode.ThemeIcon('diff-modified');
}

function getChangedFileLetterIcon(status: string) {
  const normalizedStatus = status[0];
  if (!normalizedStatus) {
    return null;
  }

  const colorByStatus: Record<string, string> = {
    A: '#3fb950',
    M: '#d29922',
    D: '#f85149',
    R: '#58a6ff',
  };
  const color = colorByStatus[normalizedStatus];
  if (!color) {
    return null;
  }

  return vscode.Uri.parse(
    `data:image/svg+xml;utf8,${encodeURIComponent(createLetterIconSvg(normalizedStatus, color))}`,
  );
}

function createLetterIconSvg(letter: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><text x="8" y="12" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12" font-weight="700" fill="${color}">${letter}</text></svg>`;
}

function formatStat(value: number | null) {
  return value == null ? '-' : String(value);
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

function markdownTooltipLine(label: string, value: string) {
  return `**${label}:** ${escapeMarkdown(value)}`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}
