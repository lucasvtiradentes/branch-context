import { existsSync, readFileSync, statSync } from 'node:fs';
import { type AgentSession, AgentSessionProvider, asRecord, asString } from '@branch-context/core';
import * as vscode from 'vscode';
import { isAgentSessionActive } from '../core/active-agent-sessions';
import { type AgentSessionPin, readAgentSessionPins } from '../core/agent-session-pins';
import { getBranchContextState } from '../core/state';
import { groupByDate } from '../lib/date-groups';
import { formatRelativeTime } from '../lib/format-relative-time';
import { markdownTooltipLine } from '../lib/markdown';
import { isStringValue } from '../lib/string-values';
import {
  BranchContextTreeNodeKind,
  createInactiveAgentSessionResourceUri,
  createMessageNode,
  StateTreeProvider,
} from './items';

const agentSessionsGroupByValues = ['flat', 'provider', 'date', 'size'] as const;
const agentSessionTextModeValues = ['initial', 'last'] as const;
const agentSessionsGroupByWorkspaceKey = 'agentSessions.groupBy';
const agentSessionTextModeWorkspaceKey = 'agentSessions.textMode';
const MAX_SESSION_FILE_BYTES = 2 * 1024 * 1024;

export type AgentSessionsGroupBy = (typeof agentSessionsGroupByValues)[number];
type AgentSessionTextMode = (typeof agentSessionTextModeValues)[number];
type SavedAgentSessionsGroupBy = AgentSessionsGroupBy | 'recent';

type AgentSessionViewItem = {
  session: AgentSession;
  details: AgentSessionDetails;
  sizeBytes: number;
  pin: AgentSessionPin | null;
};

type AgentSessionDetails = {
  initialMessage: string | null;
  lastMessage: string | null;
};

type UserMessageExtraction = {
  text: string;
  fallback?: boolean;
  lastOnly?: boolean;
};

let agentSessionsGroupBy: AgentSessionsGroupBy = 'provider';
let agentSessionTextMode: AgentSessionTextMode = 'initial';

export function initializeAgentSessionsViewState(context: vscode.ExtensionContext): void {
  const savedGroupBy = context.workspaceState.get<unknown>(agentSessionsGroupByWorkspaceKey);
  if (isAgentSessionsGroupBy(savedGroupBy)) {
    agentSessionsGroupBy = normalizeAgentSessionsGroupBy(savedGroupBy);
  }

  const savedTextMode = context.workspaceState.get<unknown>(agentSessionTextModeWorkspaceKey);
  if (isAgentSessionTextMode(savedTextMode)) {
    agentSessionTextMode = savedTextMode;
  }
}

export function getAgentSessionsGroupBy(): AgentSessionsGroupBy {
  return agentSessionsGroupBy;
}

export function getAgentSessionsViewDescription(): string {
  if (agentSessionTextMode === 'last') {
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

export async function toggleAgentSessionTextMode(
  context: vscode.ExtensionContext,
): Promise<AgentSessionTextMode> {
  const currentIndex = agentSessionTextModeValues.indexOf(agentSessionTextMode);
  const nextMode =
    agentSessionTextModeValues[(currentIndex + 1) % agentSessionTextModeValues.length] ?? 'initial';
  agentSessionTextMode = nextMode;
  await context.workspaceState.update(agentSessionTextModeWorkspaceKey, nextMode);
  return nextMode;
}

export function createAgentSessionsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    const pins = readAgentSessionPins();
    const items = state.agentSessions.map((session) => createSessionViewItem(session, pins));
    if (items.length === 0) {
      return [createMessageNode('No sessions')];
    }

    return groupAgentSessions(items);
  });
}

function createGroupNode(
  label: string,
  sessions: AgentSessionViewItem[],
  icon: vscode.TreeItem['iconPath'],
  collapsibleState?: vscode.TreeItemCollapsibleState,
  showSessionIcons = true,
) {
  return {
    label,
    kind: BranchContextTreeNodeKind.Group,
    description: String(sessions.length),
    icon,
    collapsibleState,
    children: () =>
      sessions.map((session) =>
        createAgentSessionNode(session, {
          showIcon: showSessionIcons,
        }),
      ),
  };
}

function createAgentSessionNode(
  item: AgentSessionViewItem,
  options: { showIcon?: boolean; pinned?: boolean } = {},
) {
  const session = item.session;
  const description = formatRelativeTime(session.updatedAt ?? session.startedAt);
  const path = session.path ?? undefined;
  const active = isAgentSessionActive(session);
  const showIcon = options.showIcon ?? true;
  const pinned = options.pinned ?? Boolean(item.pin);

  return {
    label: pinned
      ? (item.pin?.description ?? getSessionDisplayText(item))
      : getSessionDisplayText(item),
    kind: BranchContextTreeNodeKind.Agent,
    path,
    agentProvider: session.provider,
    sessionId: session.sessionId,
    pinned,
    pinDescription: item.pin?.description,
    description: pinned ? `${formatProviderName(session.provider)} ${description}` : description,
    tooltip: createAgentTooltip(item),
    icon: showIcon ? getProviderIcon(session.provider, active) : new vscode.ThemeIcon('blank'),
    resourceUri: active ? undefined : createInactiveAgentSessionResourceUri(session.sessionId),
    useResourceUri: showIcon,
    contextValue: createAgentSessionContextValue(pinned),
    command: path
      ? {
          command: 'vscode.open',
          title: 'Open',
          arguments: [vscode.Uri.file(path)],
        }
      : undefined,
  };
}

function createSessionViewItem(
  session: AgentSession,
  pins: AgentSessionPin[],
): AgentSessionViewItem {
  const path = session.path ?? null;
  return {
    session,
    details: readSessionDetails(path),
    sizeBytes: getSessionSize(path),
    pin:
      pins.find(
        (pin) => pin.provider === session.provider && pin.sessionId === session.sessionId,
      ) ?? null,
  };
}

function groupAgentSessions(items: AgentSessionViewItem[]) {
  const pinnedItems = getPinnedItems(items);
  const unpinnedItems = items.filter((item) => !item.pin);
  const groupedItems = groupUnpinnedAgentSessions(unpinnedItems);

  if (pinnedItems.length === 0) {
    return groupedItems;
  }

  return [
    {
      label: 'Pinned',
      kind: BranchContextTreeNodeKind.Group,
      description: String(pinnedItems.length),
      icon: new vscode.ThemeIcon('pinned'),
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      children: () =>
        pinnedItems.map((item) =>
          createAgentSessionNode(item, {
            pinned: true,
          }),
        ),
    },
    ...groupedItems,
  ];
}

function groupUnpinnedAgentSessions(items: AgentSessionViewItem[]) {
  if (agentSessionsGroupBy === 'flat') {
    return items.map((item) => createAgentSessionNode(item));
  }

  if (agentSessionsGroupBy === 'date') {
    return groupByDate(items, (item) => item.session.updatedAt ?? item.session.startedAt).map(
      (group) =>
        createAgentSessionGroupNode(
          {
            label: group.label,
            sessions: group.items,
            icon: new vscode.ThemeIcon('calendar'),
          },
          vscode.TreeItemCollapsibleState.Expanded,
        ),
    );
  }

  if (agentSessionsGroupBy === 'size') {
    return createOrderedGroups(items, ['Small', 'Medium', 'Large'], getSizeGroup, 'database').map(
      (group) => createAgentSessionGroupNode(group, vscode.TreeItemCollapsibleState.Expanded),
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
    }))
    .map((group) => createAgentSessionGroupNode(group, vscode.TreeItemCollapsibleState.Expanded));
}

function getPinnedItems(items: AgentSessionViewItem[]) {
  const itemsByKey = new Map(
    items.map((item) => [getAgentSessionKey(item.session.provider, item.session.sessionId), item]),
  );
  const pinnedItems: AgentSessionViewItem[] = [];

  for (const pin of readAgentSessionPins()) {
    const item = itemsByKey.get(getAgentSessionKey(pin.provider, pin.sessionId));
    if (item) {
      pinnedItems.push({ ...item, pin });
    }
  }

  return pinnedItems;
}

function getAgentSessionKey(provider: AgentSession['provider'], sessionId: string) {
  return `${provider}:${sessionId}`;
}

function createAgentSessionContextValue(pinned: boolean) {
  return `branchContext.agentSession.resumable.${pinned ? 'pinned' : 'pinnable'}`;
}

function createAgentSessionGroupNode(
  group: {
    label: string;
    sessions: AgentSessionViewItem[];
    icon: vscode.TreeItem['iconPath'];
    showSessionIcons?: boolean;
  },
  collapsibleState?: vscode.TreeItemCollapsibleState,
) {
  return createGroupNode(
    group.label,
    group.sessions,
    group.icon,
    collapsibleState,
    group.showSessionIcons,
  );
}

function createOrderedGroups(
  items: AgentSessionViewItem[],
  labels: string[],
  getLabel: (item: AgentSessionViewItem) => string,
  icon: string,
) {
  return labels
    .map((label) => ({
      label,
      sessions: items.filter((item) => getLabel(item) === label),
      icon: new vscode.ThemeIcon(icon),
    }))
    .filter((group) => group.sessions.length > 0);
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
  if (agentSessionTextMode === 'last') {
    return firstText(
      item.details.lastMessage,
      item.details.initialMessage,
      item.session.title,
      isAgentSessionActive(item.session) ? 'Starting session' : null,
    );
  }

  return firstText(
    item.details.initialMessage,
    item.session.title,
    isAgentSessionActive(item.session) ? 'Starting session' : null,
    item.session.sessionId.slice(0, 8),
  );
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? 'Untitled session';
}

function readSessionDetails(path: string | null): AgentSessionDetails {
  const details: AgentSessionDetails = {
    initialMessage: null,
    lastMessage: null,
  };
  let fallbackInitialMessage: string | null = null;
  let fallbackLastMessage: string | null = null;

  if (!path || !existsSync(path) || getSessionSize(path) > MAX_SESSION_FILE_BYTES) {
    return details;
  }

  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const data = parseJsonObject(line);
      if (!data) {
        continue;
      }

      const userMessage = extractUserMessage(data);
      if (userMessage) {
        if (userMessage.lastOnly) {
          if (userMessage.fallback) {
            fallbackLastMessage = userMessage.text;
          } else {
            details.lastMessage = userMessage.text;
          }
        } else if (userMessage.fallback) {
          fallbackInitialMessage ??= userMessage.text;
          fallbackLastMessage = userMessage.text;
        } else {
          details.initialMessage ??= userMessage.text;
          details.lastMessage = userMessage.text;
        }
      }
    }
  } catch {}

  details.initialMessage ??= fallbackInitialMessage;
  details.lastMessage ??= fallbackLastMessage;

  return details;
}

function extractUserMessage(data: Record<string, unknown>): UserMessageExtraction | null {
  if (data.type === 'last-prompt') {
    return toUserMessage(asString(data.lastPrompt), { lastOnly: true });
  }

  if (data.type === 'user') {
    return toUserMessage(extractContentTitle(asRecord(data.message)?.content));
  }

  const payload = asRecord(data.payload);
  if (data.type === 'event_msg' && payload?.type === 'user_message') {
    return toUserMessage(asString(payload.message));
  }

  if (data.type === 'response_item' && payload?.role === 'user') {
    return toUserMessage(extractContentTitle(payload.content), { fallback: true });
  }

  return null;
}

function toUserMessage(
  text: string | null,
  options?: Pick<UserMessageExtraction, 'fallback' | 'lastOnly'>,
): UserMessageExtraction | null {
  if (!text || isInternalUserMessage(text)) {
    return null;
  }

  return { text, ...options };
}

function isInternalUserMessage(text: string) {
  return text.startsWith('# AGENTS.md instructions for ');
}

function extractContentTitle(content: unknown) {
  if (typeof content === 'string') {
    return cleanTitle(content);
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((item) => asString(asRecord(item)?.text))
    .filter(Boolean)
    .join(' ');

  return cleanTitle(text);
}

function cleanTitle(value: string | null) {
  const title = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!title) {
    return null;
  }
  return title.length > 160 ? `${title.slice(0, 157)}...` : title;
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

function isAgentSessionsGroupBy(value: unknown): value is SavedAgentSessionsGroupBy {
  return isStringValue([...agentSessionsGroupByValues, 'recent'], value);
}

function normalizeAgentSessionsGroupBy(value: SavedAgentSessionsGroupBy): AgentSessionsGroupBy {
  return value === 'recent' ? 'date' : value;
}

function isAgentSessionTextMode(value: unknown): value is AgentSessionTextMode {
  return isStringValue(agentSessionTextModeValues, value);
}

function parseJsonObject(line: string) {
  try {
    const parsed = JSON.parse(line) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function getProviderSort(provider: AgentSession['provider']) {
  if (provider === AgentSessionProvider.Codex) {
    return 0;
  }

  if (provider === AgentSessionProvider.Claude) {
    return 1;
  }

  return 2;
}

function formatProviderName(provider: AgentSession['provider']) {
  if (provider === AgentSessionProvider.Codex) {
    return 'Codex';
  }

  if (provider === AgentSessionProvider.Claude) {
    return 'Claude Code';
  }

  return provider;
}

function getProviderIcon(provider: AgentSession['provider'], active: boolean) {
  if (provider === AgentSessionProvider.Codex) {
    return createLetterIcon('CX', active);
  }

  if (provider === AgentSessionProvider.Claude) {
    return createLetterIcon('CC', active);
  }

  return new vscode.ThemeIcon('account');
}

function createLetterIcon(label: string, active: boolean) {
  const color = getProviderIconColor(label, active);
  return vscode.Uri.parse(
    `data:image/svg+xml;utf8,${encodeURIComponent(createLetterIconSvg(label, color))}`,
  );
}

function getProviderIconColor(label: string, active: boolean) {
  if (label === 'CC') {
    return active ? '#f0883e' : '#a3714d';
  }

  if (label === 'CX') {
    return active ? '#58a6ff' : '#6e8fb8';
  }

  return active ? '#f0883e' : '#8b949e';
}

function createLetterIconSvg(label: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><text x="8" y="11.5" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="8.5" font-weight="700" fill="${color}">${label}</text></svg>`;
}

function createAgentTooltip(item: AgentSessionViewItem) {
  const session = item.session;
  return new vscode.MarkdownString(
    [
      markdownTooltipLine('provider', formatProviderName(session.provider)),
      markdownTooltipLine('session', getShortSessionId(session.sessionId)),
      markdownTooltipLine('branch', session.branch),
      markdownTooltipLine('scope', session.scope),
      markdownTooltipLine('model', session.model ?? 'unknown'),
      markdownTooltipLine('updated', formatRelativeTime(session.updatedAt ?? session.startedAt)),
      markdownTooltipLine('size', formatBytes(item.sizeBytes)),
      item.pin ? markdownTooltipLine('pin', item.pin.description) : null,
    ]
      .filter(Boolean)
      .join('  \n'),
  );
}

function getShortSessionId(sessionId: string) {
  return sessionId.slice(0, 7);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
