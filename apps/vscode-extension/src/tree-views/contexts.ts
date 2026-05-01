import type {
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
} from '@branch-context/core/services/status';
import * as vscode from 'vscode';
import { getBranchContextState } from '../core/state';
import { formatRelativeTime } from '../lib/format-relative-time';
import { createContextNode, createGroupNode, createMessageNode, StateTreeProvider } from './items';

const contextsGroupByValues = ['status', 'recent', 'size', 'template'] as const;
export type ContextsGroupBy = (typeof contextsGroupByValues)[number];

type ContextViewItem = {
  branch: string;
  branchKey: string;
  contextDir: string;
  updatedAt: string | null;
  template: string;
  commitCount: number;
  changedFileCount: number;
  sizeBytes: number;
  archived: boolean;
  current: boolean;
  local: boolean;
  remote: boolean;
};

let contextsGroupBy: ContextsGroupBy = 'status';
const contextsGroupByWorkspaceKey = 'contexts.groupBy';

export function initializeContextsGroupBy(context: vscode.ExtensionContext): void {
  const savedGroupBy = context.workspaceState.get<unknown>(contextsGroupByWorkspaceKey);
  if (isContextsGroupBy(savedGroupBy)) {
    contextsGroupBy = savedGroupBy;
  }
}

export function getContextsGroupBy(): ContextsGroupBy {
  return contextsGroupBy;
}

export async function saveContextsGroupBy(
  context: vscode.ExtensionContext,
  nextGroupBy: ContextsGroupBy,
): Promise<void> {
  contextsGroupBy = nextGroupBy;
  await context.workspaceState.update(contextsGroupByWorkspaceKey, nextGroupBy);
}

function isContextsGroupBy(value: unknown): value is ContextsGroupBy {
  return typeof value === 'string' && (contextsGroupByValues as readonly string[]).includes(value);
}

export function createContextsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    const contexts = [
      ...state.recentContexts.map(toActiveContext),
      ...state.archivedContexts.map(toArchivedContext),
    ].sort(compareByUpdatedAt);

    if (contexts.length === 0) {
      return [createMessageNode('No contexts')];
    }

    return groupContexts(contexts).map((group) =>
      createGroupNode(
        group.label,
        group.contexts.map(createContextTreeNode),
        `${group.contexts.length}`,
      ),
    );
  });
}

function toActiveContext(context: BranchContextContextSummary): ContextViewItem {
  return {
    ...context,
    archived: false,
    current: context.current,
  };
}

function toArchivedContext(context: BranchContextArchivedContextSummary): ContextViewItem {
  return {
    ...context,
    archived: true,
    current: false,
    local: false,
    remote: false,
  };
}

function groupContexts(contexts: ContextViewItem[]) {
  if (contextsGroupBy === 'recent') {
    return createOrderedGroups(contexts, ['Today', 'This week', 'Older'], getRecentGroup);
  }

  if (contextsGroupBy === 'size') {
    return createOrderedGroups(contexts, ['Small', 'Medium', 'Large'], getSizeGroup);
  }

  if (contextsGroupBy === 'template') {
    return createSortedGroups(contexts, (context) => context.template || 'Unknown');
  }

  return createOrderedGroups(contexts, ['Active', 'Archived'], (context) =>
    context.archived ? 'Archived' : 'Active',
  );
}

function createOrderedGroups(
  contexts: ContextViewItem[],
  labels: string[],
  getLabel: (context: ContextViewItem) => string,
) {
  return labels
    .map((label) => ({
      label,
      contexts: contexts.filter((context) => getLabel(context) === label),
    }))
    .filter((group) => group.contexts.length > 0);
}

function createSortedGroups(
  contexts: ContextViewItem[],
  getLabel: (context: ContextViewItem) => string,
) {
  const groups = new Map<string, ContextViewItem[]>();
  for (const context of contexts) {
    const label = getLabel(context);
    let group = groups.get(label);
    if (!group) {
      group = [];
      groups.set(label, group);
    }
    group.push(context);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedContexts]) => ({
      label,
      contexts: groupedContexts,
    }));
}

function createContextTreeNode(context: ContextViewItem) {
  return createContextNode(context.branch, context.contextDir, {
    branch: context.branch,
    branchKey: context.branchKey,
    archived: context.archived,
    current: context.current,
    local: context.local,
    remote: context.remote,
    contextValue: createContextValue(context),
    description: createContextDescription(context),
    tooltip: createContextTooltip(context),
    icon: context.archived
      ? new vscode.ThemeIcon('archive')
      : context.current
        ? new vscode.ThemeIcon('star-full')
        : new vscode.ThemeIcon('git-branch'),
  });
}

function createContextValue(context: ContextViewItem) {
  const values = ['branchContext.context'];

  if (!context.archived && !context.current && context.local) {
    values.push('checkoutable');
  }

  if (!context.archived && !context.current) {
    values.push('archivable');
  }

  if (context.archived) {
    values.push('restorable');
  }

  if (!context.current) {
    values.push('deletable');
  }

  return values.join('.');
}

function createContextDescription(context: ContextViewItem) {
  return [
    formatRelativeTime(context.updatedAt),
    formatCount(context.commitCount, 'commit'),
    formatCount(context.changedFileCount, 'file'),
    getSizeBadge(context.sizeBytes),
  ].join(' | ');
}

function createContextTooltip(context: ContextViewItem) {
  return new vscode.MarkdownString(
    [
      markdownTooltipLine('name', context.branch),
      markdownTooltipLine('status', context.archived ? 'archived' : 'active'),
      markdownTooltipLine('template', context.template),
      markdownTooltipLine('updated', formatRelativeTime(context.updatedAt)),
      markdownTooltipLine('commits', String(context.commitCount)),
      markdownTooltipLine('changed files', String(context.changedFileCount)),
      markdownTooltipLine('size', formatBytes(context.sizeBytes)),
    ].join('  \n'),
  );
}

function markdownTooltipLine(label: string, value: string) {
  return `**${label}:** ${escapeMarkdown(value)}`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

function getRecentGroup(context: ContextViewItem) {
  const updatedAt = context.updatedAt ? Date.parse(context.updatedAt) : Number.NaN;
  if (Number.isNaN(updatedAt)) {
    return 'Older';
  }

  const ageMs = Date.now() - updatedAt;
  if (ageMs < 24 * 60 * 60 * 1000) {
    return 'Today';
  }

  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return 'This week';
  }

  return 'Older';
}

function getSizeGroup(context: ContextViewItem) {
  if (context.sizeBytes < 64 * 1024) {
    return 'Small';
  }

  if (context.sizeBytes < 1024 * 1024) {
    return 'Medium';
  }

  return 'Large';
}

function getSizeBadge(sizeBytes: number) {
  const group = sizeBytes < 64 * 1024 ? 'Small' : sizeBytes < 1024 * 1024 ? 'Medium' : 'Large';
  return `[${group[0]}]`;
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function compareByUpdatedAt(left: ContextViewItem, right: ContextViewItem) {
  if (left.updatedAt === right.updatedAt) {
    return left.branch.localeCompare(right.branch);
  }

  if (!left.updatedAt) {
    return 1;
  }

  if (!right.updatedAt) {
    return -1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}
