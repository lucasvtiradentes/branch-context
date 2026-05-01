import { type Dirent, existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { GitCommitSummary } from '@branch-context/core';
import { AGENTS_FILE_NAME } from '@branch-context/core';
import * as vscode from 'vscode';
import { CONTEXT_FILE_NAME } from '../constants';
import { onDidChangeState } from '../core/state';

const MAX_DIRECTORY_ITEMS = 200;
const archivedContextResourceScheme = 'branch-context-archived';
const inactiveAgentSessionResourceScheme = 'branch-context-inactive-agent';

type BranchContextTreeNodeKind =
  | 'message'
  | 'file'
  | 'folder'
  | 'group'
  | 'context'
  | 'template'
  | 'commit'
  | 'agent';

export type BranchContextTreeNode = {
  label: string;
  kind: BranchContextTreeNodeKind;
  path?: string;
  branch?: string;
  branchKey?: string;
  archived?: boolean;
  current?: boolean;
  local?: boolean;
  remote?: boolean;
  agentProvider?: 'claude' | 'codex';
  sessionId?: string;
  commit?: GitCommitSummary;
  contextValue?: string;
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  icon?: vscode.TreeItem['iconPath'];
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  useResourceUri?: boolean;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  children?: () => BranchContextTreeNode[];
};

export class StateTreeProvider
  implements vscode.TreeDataProvider<BranchContextTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<BranchContextTreeNode | undefined>();
  private readonly stateDisposable = onDidChangeState(() => this.refresh());

  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly getRootNodes: () => BranchContextTreeNode[]) {}

  getTreeItem(node: BranchContextTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      node.label,
      node.children
        ? (node.collapsibleState ?? vscode.TreeItemCollapsibleState.Collapsed)
        : vscode.TreeItemCollapsibleState.None,
    );

    item.description = node.description;
    item.tooltip = node.tooltip ?? node.path;
    item.contextValue = node.contextValue ?? node.kind;
    item.iconPath = node.icon;
    item.command = node.command;

    if (node.resourceUri) {
      item.resourceUri = node.resourceUri;
    } else if (node.path && node.useResourceUri !== false) {
      item.resourceUri = vscode.Uri.file(node.path);
    }

    return item;
  }

  getChildren(node?: BranchContextTreeNode): BranchContextTreeNode[] {
    return node?.children?.() ?? this.getRootNodes();
  }

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  dispose(): void {
    this.stateDisposable.dispose();
    this.changeEmitter.dispose();
  }
}

export function initializeTreeItemDecorations(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider({
      provideFileDecoration(uri) {
        if (
          uri.scheme !== archivedContextResourceScheme &&
          uri.scheme !== inactiveAgentSessionResourceScheme
        ) {
          return undefined;
        }

        return new vscode.FileDecoration(
          undefined,
          uri.scheme === archivedContextResourceScheme
            ? 'Archived branch context'
            : 'Inactive agent session',
          new vscode.ThemeColor('disabledForeground'),
        );
      },
    }),
  );
}

export function createArchivedContextResourceUri(branchKey: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: archivedContextResourceScheme,
    authority: 'branch',
    path: `/${branchKey}`,
  });
}

export function createInactiveAgentSessionResourceUri(sessionId: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: inactiveAgentSessionResourceScheme,
    authority: 'session',
    path: `/${sessionId}`,
  });
}

export function createMessageNode(label: string): BranchContextTreeNode {
  return {
    label,
    kind: 'message',
    icon: new vscode.ThemeIcon('info'),
  };
}

export function createGroupNode(
  label: string,
  children: BranchContextTreeNode[],
  descriptionOrOptions?: string | GroupNodeOptions,
): BranchContextTreeNode {
  const options =
    typeof descriptionOrOptions === 'string'
      ? { description: descriptionOrOptions }
      : (descriptionOrOptions ?? {});

  return {
    label,
    kind: 'group',
    description: options.description,
    icon: options.icon ?? new vscode.ThemeIcon('folder'),
    collapsibleState: options.collapsibleState,
    children: () => children,
  };
}

type GroupNodeOptions = {
  description?: string;
  icon?: vscode.TreeItem['iconPath'];
  collapsibleState?: vscode.TreeItemCollapsibleState;
};

type ContextNodeOptions = {
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  icon?: vscode.ThemeIcon;
  branch?: string;
  branchKey?: string;
  archived?: boolean;
  current?: boolean;
  local?: boolean;
  remote?: boolean;
  contextValue?: string;
  resourceUri?: vscode.Uri;
  useResourceUri?: boolean;
};

export function createContextNode(
  label: string,
  contextDir: string,
  options?: ContextNodeOptions,
): BranchContextTreeNode {
  return {
    label,
    kind: 'context',
    path: contextDir,
    ...options,
    tooltip: options?.tooltip ?? contextDir,
    icon: options?.icon ?? new vscode.ThemeIcon('git-branch'),
    children: () => readDirectoryNodes(contextDir),
  };
}

export function createTemplateNode(label: string, templateDir: string): BranchContextTreeNode {
  const contextFile = join(templateDir, CONTEXT_FILE_NAME);
  const hasContextFile = existsSync(contextFile);
  const path = hasContextFile ? contextFile : templateDir;
  return {
    label,
    kind: 'template',
    path,
    tooltip: path,
    icon: new vscode.ThemeIcon('symbol-namespace'),
    command: hasContextFile ? openFileCommand(contextFile) : undefined,
  };
}

function createFileNode(path: string, label = basename(path)): BranchContextTreeNode {
  return {
    label,
    kind: 'file',
    path,
    tooltip: path,
    icon: new vscode.ThemeIcon('file'),
    command: openFileCommand(path),
  };
}

export function readDirectoryNodes(dir: string): BranchContextTreeNode[] {
  if (!existsSync(dir)) {
    return [createMessageNode('Missing')];
  }

  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !isSensitiveFile(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  } catch {
    return [createMessageNode('Unavailable')];
  }

  const visibleEntries = entries.slice(0, MAX_DIRECTORY_ITEMS);
  const nodes = visibleEntries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return {
        label: entry.name,
        kind: 'folder' as const,
        path,
        tooltip: path,
        icon: new vscode.ThemeIcon('folder'),
        children: () => readDirectoryNodes(path),
      };
    }

    return createFileNode(path, entry.name);
  });

  if (entries.length > visibleEntries.length) {
    nodes.push(createMessageNode(`${entries.length - visibleEntries.length} more hidden`));
  }

  return nodes;
}

function openFileCommand(path: string): vscode.Command {
  return {
    command: 'vscode.open',
    title: 'Open',
    arguments: [vscode.Uri.file(path)],
  };
}

function isSensitiveFile(name: string): boolean {
  return (
    name === AGENTS_FILE_NAME ||
    name === '.env' ||
    name.startsWith('.env.') ||
    name.endsWith('.pem') ||
    name.endsWith('.key')
  );
}
