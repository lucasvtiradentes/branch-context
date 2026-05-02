import type {
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { getBranchContextState } from '../../core/state';
import { formatBytes } from '../../lib/format/bytes';
import { formatRelativeTime } from '../../lib/format/relative-time';
import { createOrderedGroups, groupByDate } from '../../lib/groups';
import { isStringValue } from '../../lib/is-string-value';
import { markdownTooltipLine } from '../../lib/markdown';
import {
  createArchivedContextResourceUri,
  createContextNode,
  createGroupNode,
  createMessageNode,
  StateTreeProvider,
} from '../items';

export enum ContextsGroupBy {
  Flat = 'flat',
  Status = 'status',
  Date = 'date',
  Size = 'size',
  Template = 'template',
}

enum LegacyContextsGroupBy {
  Recent = 'recent',
}

const contextsGroupByValues = Object.values(ContextsGroupBy);
type SavedContextsGroupBy = ContextsGroupBy | LegacyContextsGroupBy;

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

type ContextViewGroup = {
  label: string;
  contexts: ContextViewItem[];
};

let contextsGroupBy: ContextsGroupBy = ContextsGroupBy.Status;
const contextsGroupByWorkspaceKey = 'contexts.groupBy';

export function initializeContextsGroupBy(context: vscode.ExtensionContext): void {
  const savedGroupBy = context.workspaceState.get<unknown>(contextsGroupByWorkspaceKey);
  if (isContextsGroupBy(savedGroupBy)) {
    contextsGroupBy = normalizeContextsGroupBy(savedGroupBy);
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

function isContextsGroupBy(value: unknown): value is SavedContextsGroupBy {
  return isStringValue([...contextsGroupByValues, LegacyContextsGroupBy.Recent], value);
}

function normalizeContextsGroupBy(value: SavedContextsGroupBy): ContextsGroupBy {
  return value === LegacyContextsGroupBy.Recent ? ContextsGroupBy.Date : value;
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
    ]
      .filter((context) => !isCurrentContext(context, state.currentBranch))
      .sort(compareByUpdatedAt);

    if (contexts.length === 0) {
      return [createMessageNode('No other branches')];
    }

    return groupContexts(contexts);
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
  if (contextsGroupBy === ContextsGroupBy.Flat) {
    return contexts.map(createContextTreeNode);
  }

  if (contextsGroupBy === ContextsGroupBy.Date) {
    return createContextGroupNodes(
      groupByDate(contexts, (context) => context.updatedAt).map((group) => ({
        label: group.label,
        contexts: group.items,
      })),
    );
  }

  if (contextsGroupBy === ContextsGroupBy.Size) {
    return createContextGroupNodes(
      createOrderedGroups(contexts, ['Small', 'Medium', 'Large'], getSizeGroup).map(
        contextGroupFromItems,
      ),
    );
  }

  if (contextsGroupBy === ContextsGroupBy.Template) {
    return createContextGroupNodes(
      createSortedGroups(contexts, (context) => context.template || 'Unknown'),
    );
  }

  return createContextGroupNodes(
    createOrderedGroups(contexts, ['Active', 'Archived'], (context) =>
      context.archived ? 'Archived' : 'Active',
    ).map(contextGroupFromItems),
  );
}

function contextGroupFromItems(group: { label: string; items: ContextViewItem[] }) {
  return { label: group.label, contexts: group.items };
}

function createContextGroupNodes(groups: ContextViewGroup[]) {
  return groups.map((group) =>
    createGroupNode(
      group.label,
      group.contexts.map(createContextTreeNode),
      `${group.contexts.length}`,
    ),
  );
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
    resourceUri: context.archived ? createArchivedContextResourceUri(context.branchKey) : undefined,
    useResourceUri: false,
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

function isCurrentContext(context: ContextViewItem, currentBranch: string | null) {
  return context.current || (!!currentBranch && context.branch === currentBranch);
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
  return formatRelativeTime(context.updatedAt);
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
      markdownTooltipLine('size', formatBytes(context.sizeBytes, 0)),
    ].join('  \n'),
  );
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
