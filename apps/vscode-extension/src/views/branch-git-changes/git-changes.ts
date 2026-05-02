import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BranchGitSummary,
  GitChangedFileSummary,
  GitCommitSummary,
} from '@branch-context/core';
import { BranchGitSummaryErrorReason, GitFileStatus } from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds, contextKeys } from '../../constants';
import { type BranchContextExtensionState, getBranchContextState } from '../../core/state';
import { groupByDate } from '../../lib/date-groups';
import { formatRelativeTime } from '../../lib/format-relative-time';
import { markdownTooltipLine } from '../../lib/markdown';
import { isStringValue } from '../../lib/string-values';
import {
  type BranchContextTreeNode,
  BranchContextTreeNodeKind,
  createGroupNode,
  createMessageNode,
  StateTreeProvider,
} from '../items';

enum GitChangesMode {
  Files = 'files',
  Commits = 'commits',
}

export enum GitChangedFilesGroupBy {
  Flat = 'flat',
  ChangeType = 'changeType',
}

export enum GitCommitsGroupBy {
  Flat = 'flat',
  Date = 'date',
  Author = 'author',
}

const gitChangesModeValues = Object.values(GitChangesMode);
const gitChangedFilesGroupByValues = Object.values(GitChangedFilesGroupBy);
const gitCommitsGroupByValues = Object.values(GitCommitsGroupBy);
const gitChangesViewDescriptions = {
  [GitChangesMode.Files]: 'changed files',
  [GitChangesMode.Commits]: 'commits',
} as const;
const changedFileThemeIcons = {
  [GitFileStatus.Added]: 'diff-added',
  [GitFileStatus.Deleted]: 'diff-removed',
  [GitFileStatus.Renamed]: 'diff-renamed',
  [GitFileStatus.Modified]: 'diff-modified',
} as const;
const changedFileLetterColors = {
  [GitFileStatus.Added]: '#3fb950',
  [GitFileStatus.Modified]: '#d29922',
  [GitFileStatus.Deleted]: '#f85149',
  [GitFileStatus.Renamed]: '#58a6ff',
} as const;
const gitChangesModeWorkspaceKey = 'gitChanges.mode';
const gitChangedFilesGroupByWorkspaceKey = 'gitChanges.filesGroupBy';
const gitCommitsGroupByWorkspaceKey = 'gitChanges.commitsGroupBy';

let gitChangesMode: GitChangesMode = GitChangesMode.Files;
let gitChangedFilesGroupBy: GitChangedFilesGroupBy = GitChangedFilesGroupBy.Flat;
let gitCommitsGroupBy: GitCommitsGroupBy = GitCommitsGroupBy.Flat;

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
  return gitChangesViewDescriptions[gitChangesMode];
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
  const nextMode =
    gitChangesMode === GitChangesMode.Files ? GitChangesMode.Commits : GitChangesMode.Files;
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

    return gitChangesMode === GitChangesMode.Files
      ? createChangedFileNodes(state)
      : createCommitNodes(state.gitSummary);
  });
}

function isGitChangesMode(value: unknown): value is GitChangesMode {
  return isStringValue(gitChangesModeValues, value);
}

function isGitChangedFilesGroupBy(value: unknown): value is GitChangedFilesGroupBy {
  return isStringValue(gitChangedFilesGroupByValues, value);
}

function updateGitChangesModeContext(): void {
  void vscode.commands.executeCommand('setContext', contextKeys.gitChangesMode, gitChangesMode);
}

function isGitCommitsGroupBy(value: unknown): value is GitCommitsGroupBy {
  return isStringValue(gitCommitsGroupByValues, value);
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
  if (gitCommitsGroupBy === GitCommitsGroupBy.Date) {
    return groupByDate(commits, (commit) => commit.authoredAt).map((group) =>
      createGroupNode(group.label, group.items.map(createCommitNode), String(group.items.length)),
    );
  }

  if (gitCommitsGroupBy === GitCommitsGroupBy.Author) {
    return createSortedCommitGroups(commits, (commit) => commit.authorName);
  }

  return commits.map(createCommitNode);
}

function groupChangedFileNodes(workspaceRoot: string | null, files: GitChangedFileSummary[]) {
  if (gitChangedFilesGroupBy !== GitChangedFilesGroupBy.ChangeType) {
    return files.map((file) => createChangedFileNode(workspaceRoot, file));
  }

  return [
    createChangedFileGroup(
      workspaceRoot,
      files,
      'Added',
      [GitFileStatus.Added],
      getChangedFileIcon(GitFileStatus.Added),
    ),
    createChangedFileGroup(
      workspaceRoot,
      files,
      'Modified',
      [GitFileStatus.Modified],
      getChangedFileIcon(GitFileStatus.Modified),
    ),
    createChangedFileGroup(
      workspaceRoot,
      files,
      'Renamed',
      [GitFileStatus.Renamed],
      getChangedFileIcon(GitFileStatus.Renamed),
    ),
    createChangedFileGroup(
      workspaceRoot,
      files,
      'Deleted',
      [GitFileStatus.Deleted],
      getChangedFileIcon(GitFileStatus.Deleted),
    ),
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
      : !Object.values(GitFileStatus).includes(file.status as GitFileStatus),
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
    kind: BranchContextTreeNodeKind.File,
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
    kind: BranchContextTreeNodeKind.Commit,
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
  if (gitSummary.reason === BranchGitSummaryErrorReason.BaseNotFound) {
    return `Base not found: ${gitSummary.baseBranch ?? 'unknown'}`;
  }

  return 'No base branch';
}

function getChangedFileIcon(status: string) {
  const icon = getChangedFileLetterIcon(status);
  if (icon) {
    return icon;
  }

  return new vscode.ThemeIcon(
    changedFileThemeIcons[status as GitFileStatus] ?? changedFileThemeIcons[GitFileStatus.Modified],
  );
}

function getChangedFileLetterIcon(status: string) {
  const normalizedStatus = status[0];
  if (!normalizedStatus) {
    return null;
  }

  const color = changedFileLetterColors[normalizedStatus as GitFileStatus];
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
