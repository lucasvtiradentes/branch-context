import { join } from 'node:path';
import type {
  AgentSession,
  BranchContextArchivedContextSummary,
  BranchContextContextSummary,
} from '@branch-context/core';
import {
  AGENTS_FILE_NAME,
  AgentSessionScope,
  createAgentSession,
  readAgentsFile,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { contextKeys } from '../../../constants';
import { formatBytes } from '../../../shared/format/bytes';
import { markdownTooltipLine } from '../../../shared/format/markdown';
import { formatRelativeTime } from '../../../shared/format/relative-time';
import { createOrderedGroups, groupByDate } from '../../../shared/groups';
import { isStringValue } from '../../../shared/is-string-value';
import {
  createArchivedContextResourceUri,
  createContextNode,
  createGroupNode,
  createMessageNode,
  StateTreeProvider,
} from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';
import {
  createAgentSessionNode,
  createSessionViewItem,
} from '../../agent-sessions/views/agent-sessions';

export enum ContextsGroupBy {
  Flat = 'flat',
  Status = 'status',
  Date = 'date',
  Size = 'size',
  Template = 'template',
}

enum OtherBranchesViewMode {
  ContextFiles = 'contextFiles',
  AgentSessions = 'agentSessions',
}

enum LegacyContextsGroupBy {
  Recent = 'recent',
}

const contextsGroupByValues = Object.values(ContextsGroupBy);
const otherBranchesViewModeValues = Object.values(OtherBranchesViewMode);
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
let otherBranchesViewMode: OtherBranchesViewMode = OtherBranchesViewMode.ContextFiles;
const contextsGroupByWorkspaceKey = 'contexts.groupBy';
const otherBranchesViewModeWorkspaceKey = 'contexts.mode';

export function initializeContextsViewState(context: vscode.ExtensionContext): void {
  const savedGroupBy = context.workspaceState.get<unknown>(contextsGroupByWorkspaceKey);
  if (isContextsGroupBy(savedGroupBy)) {
    contextsGroupBy = normalizeContextsGroupBy(savedGroupBy);
  }

  const savedMode = context.workspaceState.get<unknown>(otherBranchesViewModeWorkspaceKey);
  if (isOtherBranchesViewMode(savedMode)) {
    otherBranchesViewMode = savedMode;
  }
  setOtherBranchesModeContext();
}

export function getContextsGroupBy(): ContextsGroupBy {
  return contextsGroupBy;
}

export function getOtherBranchesViewDescription(): string {
  return otherBranchesViewMode === OtherBranchesViewMode.AgentSessions
    ? 'ai sessions'
    : 'context files';
}

export async function saveContextsGroupBy(
  context: vscode.ExtensionContext,
  nextGroupBy: ContextsGroupBy,
): Promise<void> {
  contextsGroupBy = nextGroupBy;
  await context.workspaceState.update(contextsGroupByWorkspaceKey, nextGroupBy);
}

export async function toggleOtherBranchesViewMode(
  context: vscode.ExtensionContext,
): Promise<OtherBranchesViewMode> {
  otherBranchesViewMode =
    otherBranchesViewMode === OtherBranchesViewMode.ContextFiles
      ? OtherBranchesViewMode.AgentSessions
      : OtherBranchesViewMode.ContextFiles;
  await context.workspaceState.update(otherBranchesViewModeWorkspaceKey, otherBranchesViewMode);
  setOtherBranchesModeContext();
  return otherBranchesViewMode;
}

function isContextsGroupBy(value: unknown): value is SavedContextsGroupBy {
  return isStringValue([...contextsGroupByValues, LegacyContextsGroupBy.Recent], value);
}

function normalizeContextsGroupBy(value: SavedContextsGroupBy): ContextsGroupBy {
  return value === LegacyContextsGroupBy.Recent ? ContextsGroupBy.Date : value;
}

function isOtherBranchesViewMode(value: unknown): value is OtherBranchesViewMode {
  return isStringValue(otherBranchesViewModeValues, value);
}

function setOtherBranchesModeContext(): void {
  void vscode.commands.executeCommand(
    'setContext',
    contextKeys.otherBranchesMode,
    otherBranchesViewMode,
  );
}

export function createContextsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = branchContextState.get();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    const contexts = getOtherBranchContexts();

    if (otherBranchesViewMode === OtherBranchesViewMode.AgentSessions) {
      return createOtherBranchAgentSessionNodes(contexts);
    }

    if (contexts.length === 0) {
      return [createMessageNode('No other branches')];
    }

    return groupContexts(contexts);
  });
}

function getOtherBranchContexts() {
  const state = branchContextState.get();
  return [
    ...state.recentContexts.map(toActiveContext),
    ...state.archivedContexts.map(toArchivedContext),
  ]
    .filter((context) => !isCurrentContext(context, state.currentBranch))
    .sort(compareByUpdatedAt);
}

function createOtherBranchAgentSessionNodes(contexts: ContextViewItem[]) {
  if (contexts.length === 0) {
    return [createMessageNode('No other branches')];
  }

  const groups = contexts.map((context) => ({
    context,
    sessions: readBranchAgentSessions(context),
  }));

  return groupBranchAgentSessions(groups);
}

type BranchAgentSessionGroup = {
  context: ContextViewItem;
  sessions: AgentSession[];
};

type BranchAgentSessionGroupContainer = {
  label: string;
  groups: BranchAgentSessionGroup[];
};

function groupBranchAgentSessions(groups: BranchAgentSessionGroup[]) {
  if (contextsGroupBy === ContextsGroupBy.Flat) {
    return groups.map(createBranchAgentSessionGroupNode);
  }

  if (contextsGroupBy === ContextsGroupBy.Date) {
    return createBranchAgentSessionGroupNodes(
      groupByDate(groups, (group) => group.context.updatedAt).map((group) => ({
        label: group.label,
        groups: group.items,
      })),
    );
  }

  if (contextsGroupBy === ContextsGroupBy.Size) {
    return createBranchAgentSessionGroupNodes(
      createOrderedGroups(groups, ['Small', 'Medium', 'Large'], (group) =>
        getSizeGroup(group.context),
      ).map(branchAgentSessionGroupFromItems),
    );
  }

  if (contextsGroupBy === ContextsGroupBy.Template) {
    return createBranchAgentSessionGroupNodes(
      createSortedBranchAgentSessionGroups(groups, (group) => group.context.template || 'Unknown'),
    );
  }

  return createBranchAgentSessionGroupNodes(
    createOrderedGroups(groups, ['Active', 'Archived'], (group) =>
      group.context.archived ? 'Archived' : 'Active',
    ).map(branchAgentSessionGroupFromItems),
  );
}

function branchAgentSessionGroupFromItems(group: {
  label: string;
  items: BranchAgentSessionGroup[];
}) {
  return { label: group.label, groups: group.items };
}

function createBranchAgentSessionGroupNodes(groups: BranchAgentSessionGroupContainer[]) {
  return groups.map((group) =>
    createGroupNode(
      group.label,
      group.groups.map(createBranchAgentSessionGroupNode),
      `${group.groups.length}`,
    ),
  );
}

function createSortedBranchAgentSessionGroups(
  groups: BranchAgentSessionGroup[],
  getLabel: (group: BranchAgentSessionGroup) => string,
) {
  const groupsByLabel = new Map<string, BranchAgentSessionGroup[]>();
  for (const group of groups) {
    const label = getLabel(group);
    let groupedItems = groupsByLabel.get(label);
    if (!groupedItems) {
      groupedItems = [];
      groupsByLabel.set(label, groupedItems);
    }
    groupedItems.push(group);
  }

  return Array.from(groupsByLabel.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedItems]) => ({
      label,
      groups: groupedItems,
    }));
}

function createBranchAgentSessionGroupNode({ context, sessions }: BranchAgentSessionGroup) {
  const agentsFilePath = getContextAgentsFilePath(context);
  return createGroupNode(
    context.branch,
    sessions.map((session) =>
      createAgentSessionNode(createSessionViewItem(session), {
        agentsFilePath,
        movable: true,
      }),
    ),
    {
      description: String(sessions.length),
      icon: context.archived ? new vscode.ThemeIcon('archive') : new vscode.ThemeIcon('git-branch'),
    },
  );
}

function readBranchAgentSessions(context: ContextViewItem): AgentSession[] {
  return readAgentsFile(getContextAgentsFilePath(context))
    .sessions.map((session) =>
      createAgentSession({
        ...session,
        branch: context.branch,
        scope: AgentSessionScope.Branch,
      }),
    )
    .sort(compareAgentSessions);
}

function getContextAgentsFilePath(context: ContextViewItem) {
  return join(context.contextDir, AGENTS_FILE_NAME);
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

function compareAgentSessions(left: AgentSession, right: AgentSession) {
  if (Boolean(left.pinned) !== Boolean(right.pinned)) {
    return left.pinned ? -1 : 1;
  }

  const leftTime = left.updatedAt ?? left.startedAt ?? '';
  const rightTime = right.updatedAt ?? right.startedAt ?? '';
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.sessionId.localeCompare(right.sessionId);
}
