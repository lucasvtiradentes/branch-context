import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BranchGitSummary,
  GitChangedFileSummary,
  GitCommitSummary,
} from '@branch-context/core/services/git-summary';
import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';
import { formatRelativeTime } from '../lib/format-relative-time';
import { type BranchContextTreeNode, createMessageNode, StateTreeProvider } from './items';

const gitChangesModeValues = ['files', 'commits'] as const;
const gitChangesModeWorkspaceKey = 'gitChanges.mode';

export type GitChangesMode = (typeof gitChangesModeValues)[number];

let gitChangesMode: GitChangesMode = 'files';

export function initializeGitChangesMode(context: vscode.ExtensionContext): void {
  const savedMode = context.workspaceState.get<unknown>(gitChangesModeWorkspaceKey);
  if (isGitChangesMode(savedMode)) {
    gitChangesMode = savedMode;
  }
}

export function getGitChangesMode(): GitChangesMode {
  return gitChangesMode;
}

export function getGitChangesViewDescription(): string {
  return gitChangesMode === 'files' ? 'changed files' : 'commits';
}

export async function toggleGitChangesMode(
  context: vscode.ExtensionContext,
): Promise<GitChangesMode> {
  const nextMode = gitChangesMode === 'files' ? 'commits' : 'files';
  gitChangesMode = nextMode;
  await context.workspaceState.update(gitChangesModeWorkspaceKey, nextMode);
  return nextMode;
}

export function createGitChangesProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    return getGitChangesMode() === 'files'
      ? createChangedFileNodes(state)
      : createCommitNodes(state.gitSummary);
  });
}

function isGitChangesMode(value: unknown): value is GitChangesMode {
  return typeof value === 'string' && (gitChangesModeValues as readonly string[]).includes(value);
}

function createChangedFileNodes(state: BranchContextExtensionState) {
  return getGitSummaryChildren(state.gitSummary, (summary) =>
    summary.changedFiles.map((file) => createChangedFileNode(state.workspaceRoot, file)),
  );
}

function createCommitNodes(gitSummary: BranchGitSummary | null) {
  return getGitSummaryChildren(gitSummary, (summary) => summary.commits.map(createCommitNode));
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
    kind: 'commit' as const,
    description: formatRelativeTime(commit.authoredAt),
    tooltip: createCommitTooltip(commit),
    icon: new vscode.ThemeIcon('git-commit'),
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
