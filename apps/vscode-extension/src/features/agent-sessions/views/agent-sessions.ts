import { statSync } from 'node:fs';
import { type AgentSession, AgentSessionProvider } from '@branch-context/core';
import * as vscode from 'vscode';
import { formatBytes } from '../../../shared/format/bytes';
import { markdownTooltipLine } from '../../../shared/format/markdown';
import { formatRelativeTime } from '../../../shared/format/relative-time';
import { createOrderedGroups, groupByDate } from '../../../shared/groups';
import { isStringValue } from '../../../shared/is-string-value';
import { logger } from '../../../shared/logger';
import {
  BranchContextTreeNodeKind,
  createInactiveAgentSessionResourceUri,
  createMessageNode,
  StateTreeProvider,
} from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';
import { isAgentSessionActive } from '../active';

export enum AgentSessionsGroupBy {
  Flat = 'flat',
  Provider = 'provider',
  Date = 'date',
  Size = 'size',
}

enum AgentSessionTextMode {
  Initial = 'initial',
  Last = 'last',
}

const agentSessionsGroupByValues = Object.values(AgentSessionsGroupBy);
const agentSessionTextModeValues = Object.values(AgentSessionTextMode);
const agentSessionsGroupByWorkspaceKey = 'agentSessions.groupBy';
const agentSessionTextModeWorkspaceKey = 'agentSessions.textMode';
const agentSessionsCollapsedGroupsWorkspaceKey = 'agentSessions.collapsedGroups';

enum ProviderIconLabel {
  Claude = 'CC',
  Codex = 'CX',
  Pi = 'PI',
}

const providerSortOrder = {
  [AgentSessionProvider.Codex]: 0,
  [AgentSessionProvider.Claude]: 1,
  [AgentSessionProvider.Pi]: 2,
} as const;
const providerNames = {
  [AgentSessionProvider.Codex]: 'Codex',
  [AgentSessionProvider.Claude]: 'Claude Code',
  [AgentSessionProvider.Pi]: 'Pi',
} as const;
const providerIconLabels = {
  [AgentSessionProvider.Codex]: ProviderIconLabel.Codex,
  [AgentSessionProvider.Claude]: ProviderIconLabel.Claude,
  [AgentSessionProvider.Pi]: ProviderIconLabel.Pi,
} as const;
const providerIconColors = {
  [ProviderIconLabel.Claude]: {
    active: '#f0883e',
    inactive: '#a3714d',
  },
  [ProviderIconLabel.Codex]: {
    active: '#58a6ff',
    inactive: '#6e8fb8',
  },
  [ProviderIconLabel.Pi]: {
    active: '#a371f7',
    inactive: '#8b6bb8',
  },
} as const;

type AgentSessionViewItem = {
  session: AgentSession;
  sizeBytes: number;
};

let agentSessionsGroupBy: AgentSessionsGroupBy = AgentSessionsGroupBy.Flat;
let agentSessionTextMode: AgentSessionTextMode = AgentSessionTextMode.Last;
let agentSessionsCollapsedGroups: Partial<Record<AgentSessionsGroupBy, Set<string>>> = {};
let lastAgentSessionsRenderLogKey: string | null = null;

export function initializeAgentSessionsViewState(context: vscode.ExtensionContext): void {
  const savedGroupBy = context.workspaceState.get<unknown>(agentSessionsGroupByWorkspaceKey);
  if (isAgentSessionsGroupBy(savedGroupBy)) {
    agentSessionsGroupBy = savedGroupBy;
  }

  const savedTextMode = context.workspaceState.get<unknown>(agentSessionTextModeWorkspaceKey);
  if (isAgentSessionTextMode(savedTextMode)) {
    agentSessionTextMode = savedTextMode;
  }

  agentSessionsCollapsedGroups = parseCollapsedGroups(
    context.workspaceState.get<unknown>(agentSessionsCollapsedGroupsWorkspaceKey),
  );
}

export function getAgentSessionsGroupBy(): AgentSessionsGroupBy {
  return agentSessionsGroupBy;
}

export function getAgentSessionsViewDescription(): string {
  if (agentSessionTextMode === AgentSessionTextMode.Last) {
    return 'last message';
  }

  return 'initial message';
}

export async function saveAgentSessionsGroupBy(
  context: vscode.ExtensionContext,
  nextGroupBy: AgentSessionsGroupBy,
): Promise<void> {
  agentSessionsGroupBy = nextGroupBy;
  await context.workspaceState.update(agentSessionsGroupByWorkspaceKey, nextGroupBy);
}

export async function saveAgentSessionGroupCollapseState(
  context: vscode.ExtensionContext,
  node: unknown,
  collapsed: boolean,
): Promise<void> {
  if (!isAgentSessionGroupNode(node)) {
    return;
  }

  const collapsedGroups = getCollapsedGroupSet(agentSessionsGroupBy);
  if (collapsed) {
    collapsedGroups.add(node.id);
  } else {
    collapsedGroups.delete(node.id);
  }

  await context.workspaceState.update(
    agentSessionsCollapsedGroupsWorkspaceKey,
    serializeCollapsedGroups(),
  );
}

export async function toggleAgentSessionTextMode(
  context: vscode.ExtensionContext,
): Promise<AgentSessionTextMode> {
  const currentIndex = agentSessionTextModeValues.indexOf(agentSessionTextMode);
  const nextMode =
    agentSessionTextModeValues[(currentIndex + 1) % agentSessionTextModeValues.length] ??
    AgentSessionTextMode.Initial;
  agentSessionTextMode = nextMode;
  await context.workspaceState.update(agentSessionTextModeWorkspaceKey, nextMode);
  return nextMode;
}

export function createAgentSessionsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = branchContextState.get();
    if (!state.workspaceRoot) {
      logger.debug('[agent-sessions:view] render workspace=none');
      return [createMessageNode('No workspace')];
    }

    const items = state.agentSessions.map((session) => createSessionViewItem(session));
    logAgentSessionsRender({
      workspaceRoot: state.workspaceRoot,
      initialized: state.initialized,
      branch: state.currentBranch,
      sessions: state.agentSessions.length,
      pins: items.filter((item) => isPinned(item.session)).length,
      items: items.length,
    });
    if (items.length === 0) {
      return [createMessageNode('No sessions')];
    }

    return groupAgentSessions(items);
  });
}

function logAgentSessionsRender(details: {
  workspaceRoot: string;
  initialized: boolean;
  branch: string | null;
  sessions: number;
  pins: number;
  items: number;
}) {
  const key = [
    details.workspaceRoot,
    details.initialized ? '1' : '0',
    details.branch ?? '',
    details.sessions,
    details.pins,
    details.items,
  ].join('|');
  if (key === lastAgentSessionsRenderLogKey) {
    return;
  }

  lastAgentSessionsRenderLogKey = key;
  logger.debug(
    `[agent-sessions:view] render workspace=${details.workspaceRoot} initialized=${details.initialized} branch=${details.branch ?? 'none'} sessions=${details.sessions} pins=${details.pins} items=${details.items}`,
  );
}

function createGroupNode(
  id: string,
  label: string,
  sessions: AgentSessionViewItem[],
  icon: vscode.TreeItem['iconPath'],
  collapsibleState?: vscode.TreeItemCollapsibleState,
  showSessionIcons = true,
) {
  return {
    id,
    label,
    kind: BranchContextTreeNodeKind.Group,
    description: String(sessions.length),
    icon,
    collapsibleState,
    children: () =>
      sessions.map((session) =>
        createAgentSessionNode(session, {
          showIcon: showSessionIcons,
          movable: true,
        }),
      ),
  };
}

export function createAgentSessionNode(
  item: AgentSessionViewItem,
  options: {
    showIcon?: boolean;
    pinned?: boolean;
    movable?: boolean;
    agentsFilePath?: string;
  } = {},
) {
  const session = item.session;
  const description = formatRelativeTime(session.updatedAt ?? session.startedAt);
  const path = session.path ?? undefined;
  const active = isAgentSessionActive(session);
  const showIcon = options.showIcon ?? true;
  const pinned = options.pinned ?? isPinned(session);
  const displayText = getSessionDisplayText(item);

  return {
    label: getSessionLabel(item),
    kind: BranchContextTreeNodeKind.Agent,
    path,
    branch: session.branch,
    agentProvider: session.provider,
    sessionId: session.sessionId,
    agentsFilePath: options.agentsFilePath,
    pinned,
    sessionDescription: session.description,
    sessionDisplayText: displayText,
    description: pinned ? `${formatProviderName(session.provider)} ${description}` : description,
    tooltip: createAgentTooltip(item),
    icon: showIcon ? getProviderIcon(session.provider, active) : new vscode.ThemeIcon('blank'),
    resourceUri: active ? undefined : createInactiveAgentSessionResourceUri(session.sessionId),
    useResourceUri: showIcon,
    contextValue: createAgentSessionContextValue({ active, pinned, movable: options.movable }),
    command: path
      ? {
          command: 'vscode.open',
          title: 'Open',
          arguments: [vscode.Uri.file(path)],
        }
      : undefined,
  };
}

export function createSessionViewItem(session: AgentSession): AgentSessionViewItem {
  const path = session.path ?? null;
  return {
    session,
    sizeBytes: getSessionSize(path),
  };
}

function groupAgentSessions(items: AgentSessionViewItem[]) {
  const pinnedItems = getPinnedItems(items);
  const unpinnedItems = items.filter((item) => !isPinned(item.session));
  const groupedItems = groupUnpinnedAgentSessions(unpinnedItems);

  if (pinnedItems.length === 0) {
    return groupedItems;
  }

  return [
    {
      label: 'Pinned',
      id: getAgentSessionGroupId('pinned'),
      kind: BranchContextTreeNodeKind.Group,
      description: String(pinnedItems.length),
      icon: new vscode.ThemeIcon('pinned'),
      collapsibleState: getAgentSessionGroupCollapsibleState(getAgentSessionGroupId('pinned')),
      children: () =>
        pinnedItems.map((item) =>
          createAgentSessionNode(item, {
            pinned: true,
            movable: true,
          }),
        ),
    },
    ...groupedItems,
  ];
}

function groupUnpinnedAgentSessions(items: AgentSessionViewItem[]) {
  if (agentSessionsGroupBy === AgentSessionsGroupBy.Flat) {
    return items.map((item) => createAgentSessionNode(item, { movable: true }));
  }

  if (agentSessionsGroupBy === AgentSessionsGroupBy.Date) {
    return groupByDate(items, (item) => item.session.updatedAt ?? item.session.startedAt).map(
      (group) =>
        createAgentSessionGroupNode(
          {
            label: group.label,
            sessions: group.items,
            icon: new vscode.ThemeIcon('calendar'),
            id: getAgentSessionGroupId(group.label),
          },
          getAgentSessionGroupCollapsibleState(getAgentSessionGroupId(group.label)),
        ),
    );
  }

  if (agentSessionsGroupBy === AgentSessionsGroupBy.Size) {
    return createOrderedGroups(items, ['Small', 'Medium', 'Large'], getSizeGroup).map((group) =>
      createAgentSessionGroupNode(
        {
          label: group.label,
          sessions: group.items,
          icon: new vscode.ThemeIcon('database'),
          id: getAgentSessionGroupId(group.label),
        },
        getAgentSessionGroupCollapsibleState(getAgentSessionGroupId(group.label)),
      ),
    );
  }

  const groups = new Map<AgentSession['provider'], AgentSessionViewItem[]>();
  for (const item of items) {
    const group = groups.get(item.session.provider) ?? [];
    group.push(item);
    groups.set(item.session.provider, group);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      return getProviderSort(left) - getProviderSort(right) || left.localeCompare(right);
    })
    .map(([provider, sessions]) => ({
      label: formatProviderName(provider),
      sessions,
      icon: getProviderIcon(provider, false),
      showSessionIcons: false,
      id: getAgentSessionGroupId(provider),
    }))
    .map((group) =>
      createAgentSessionGroupNode(group, getAgentSessionGroupCollapsibleState(group.id)),
    );
}

function getPinnedItems(items: AgentSessionViewItem[]) {
  return items
    .filter((item) => isPinned(item.session))
    .sort((left, right) => {
      const pinnedAtCompare = (right.session.pinnedAt ?? '').localeCompare(
        left.session.pinnedAt ?? '',
      );
      if (pinnedAtCompare !== 0) {
        return pinnedAtCompare;
      }

      if (left.session.provider !== right.session.provider) {
        return left.session.provider.localeCompare(right.session.provider);
      }

      return left.session.sessionId.localeCompare(right.session.sessionId);
    });
}

function createAgentSessionContextValue(options: {
  active: boolean;
  pinned: boolean;
  movable?: boolean;
}) {
  return [
    'branchContext',
    'agentSession',
    options.active ? 'active' : 'resumable',
    branchContextState.get().initialized ? 'bctx' : null,
    options.pinned ? 'pinned' : branchContextState.get().initialized ? 'pinnable' : null,
    options.movable ? 'movable' : null,
  ]
    .filter(Boolean)
    .join('.');
}

function createAgentSessionGroupNode(
  group: {
    id: string;
    label: string;
    sessions: AgentSessionViewItem[];
    icon: vscode.TreeItem['iconPath'];
    showSessionIcons?: boolean;
  },
  collapsibleState?: vscode.TreeItemCollapsibleState,
) {
  return createGroupNode(
    group.id,
    group.label,
    group.sessions,
    group.icon,
    collapsibleState,
    group.showSessionIcons,
  );
}

function getAgentSessionGroupId(groupKey: string) {
  return `agentSessions:${agentSessionsGroupBy}:${groupKey}`;
}

function getAgentSessionGroupCollapsibleState(groupId: string) {
  return getCollapsedGroupSet(agentSessionsGroupBy).has(groupId)
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.Expanded;
}

function getCollapsedGroupSet(groupBy: AgentSessionsGroupBy) {
  const collapsedGroups = agentSessionsCollapsedGroups[groupBy] ?? new Set<string>();
  agentSessionsCollapsedGroups[groupBy] = collapsedGroups;
  return collapsedGroups;
}

function serializeCollapsedGroups() {
  return Object.fromEntries(
    Object.entries(agentSessionsCollapsedGroups).map(([groupBy, collapsedGroups]) => [
      groupBy,
      Array.from(collapsedGroups).sort(),
    ]),
  );
}

function parseCollapsedGroups(value: unknown): Partial<Record<AgentSessionsGroupBy, Set<string>>> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Partial<Record<AgentSessionsGroupBy, Set<string>>> = {};
  for (const [groupBy, collapsedGroups] of Object.entries(value)) {
    if (!isAgentSessionsGroupBy(groupBy) || !Array.isArray(collapsedGroups)) {
      continue;
    }

    result[groupBy] = new Set(
      collapsedGroups.filter((groupId): groupId is string => typeof groupId === 'string'),
    );
  }

  return result;
}

function isAgentSessionGroupNode(
  node: unknown,
): node is { id: string; kind: BranchContextTreeNodeKind.Group } {
  return (
    isRecord(node) &&
    node.kind === BranchContextTreeNodeKind.Group &&
    typeof node.id === 'string' &&
    node.id.startsWith('agentSessions:')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getSizeGroup(item: AgentSessionViewItem) {
  if (item.sizeBytes < 100 * 1024) {
    return 'Small';
  }

  if (item.sizeBytes < 1024 * 1024) {
    return 'Medium';
  }

  return 'Large';
}

function getSessionDisplayText(item: AgentSessionViewItem) {
  if (item.session.description?.trim()) {
    return item.session.description.trim();
  }

  if (agentSessionTextMode === AgentSessionTextMode.Last) {
    return firstText(
      item.session.lastMessage,
      item.session.initialMessage,
      isAgentSessionActive(item.session) ? 'Starting session' : null,
    );
  }

  return firstText(
    item.session.initialMessage,
    isAgentSessionActive(item.session) ? 'Starting session' : null,
    item.session.sessionId.slice(0, 8),
  );
}

function getSessionLabel(item: AgentSessionViewItem) {
  if (item.session.description?.trim() && !isPinned(item.session)) {
    return `-> ${item.session.description.trim()}`;
  }

  return getSessionDisplayText(item);
}

function isPinned(session: AgentSession) {
  return Boolean(session.pinnedAt);
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? 'Untitled session';
}

function getSessionSize(path: string | null) {
  if (!path) {
    return 0;
  }

  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function isAgentSessionsGroupBy(value: unknown): value is AgentSessionsGroupBy {
  return isStringValue(agentSessionsGroupByValues, value);
}

function isAgentSessionTextMode(value: unknown): value is AgentSessionTextMode {
  return isStringValue(agentSessionTextModeValues, value);
}

function getProviderSort(provider: AgentSession['provider']) {
  return providerSortOrder[provider] ?? 2;
}

function formatProviderName(provider: AgentSession['provider']) {
  return providerNames[provider] ?? provider;
}

function getProviderIcon(provider: AgentSession['provider'], active: boolean) {
  const label = providerIconLabels[provider];
  if (label) {
    return createLetterIcon(label, active);
  }

  return new vscode.ThemeIcon('account');
}

function createLetterIcon(label: ProviderIconLabel, active: boolean) {
  const color = getProviderIconColor(label, active);
  return vscode.Uri.parse(
    `data:image/svg+xml;utf8,${encodeURIComponent(createLetterIconSvg(label, color))}`,
  );
}

function getProviderIconColor(label: ProviderIconLabel, active: boolean) {
  const colors = providerIconColors[label];
  if (colors) {
    return active ? colors.active : colors.inactive;
  }

  return active ? '#f0883e' : '#8b949e';
}

function createLetterIconSvg(label: ProviderIconLabel, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><text x="8" y="11.5" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="8.5" font-weight="700" fill="${color}">${label}</text></svg>`;
}

function createAgentTooltip(item: AgentSessionViewItem) {
  const session = item.session;
  return new vscode.MarkdownString(
    [
      markdownTooltipLine('provider', formatProviderName(session.provider)),
      markdownTooltipLine('session', getShortSessionId(session.sessionId)),
      markdownTooltipLine('branch', session.branch),
      markdownTooltipLine('model', session.model ?? 'unknown'),
      markdownTooltipLine('updated', formatRelativeTime(session.updatedAt ?? session.startedAt)),
      markdownTooltipLine('size', formatBytes(item.sizeBytes)),
      session.description ? markdownTooltipLine('description', session.description) : null,
    ]
      .filter(Boolean)
      .join('  \n'),
  );
}

function getShortSessionId(sessionId: string) {
  return sessionId.slice(0, 7);
}
