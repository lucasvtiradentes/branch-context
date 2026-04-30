import { type Dirent, existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import * as vscode from 'vscode';
import { CONTEXT_FILE_NAME } from '../constants';
import { onDidChangeState } from '../core/state';

const MAX_DIRECTORY_ITEMS = 200;

type BranchContextTreeNodeKind = 'message' | 'file' | 'folder' | 'context' | 'template' | 'config';

type BranchContextTreeNode = {
  label: string;
  kind: BranchContextTreeNodeKind;
  path?: string;
  description?: string;
  tooltip?: string;
  icon?: vscode.ThemeIcon;
  command?: vscode.Command;
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
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    item.description = node.description;
    item.tooltip = node.tooltip ?? node.path;
    item.contextValue = node.kind;
    item.iconPath = node.icon;
    item.command = node.command;

    if (node.path) {
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

export function createMessageNode(label: string): BranchContextTreeNode {
  return {
    label,
    kind: 'message',
    icon: new vscode.ThemeIcon('info'),
  };
}

export function createContextNode(
  label: string,
  contextDir: string,
  description?: string,
): BranchContextTreeNode {
  const contextFile = join(contextDir, CONTEXT_FILE_NAME);
  return {
    label,
    kind: 'context',
    path: contextDir,
    description,
    tooltip: contextDir,
    icon: new vscode.ThemeIcon('git-branch'),
    command: existsSync(contextFile) ? openFileCommand(contextFile) : undefined,
    children: () => readDirectoryNodes(contextDir),
  };
}

export function createTemplateNode(label: string, templateDir: string): BranchContextTreeNode {
  const contextFile = join(templateDir, CONTEXT_FILE_NAME);
  return {
    label,
    kind: 'template',
    path: templateDir,
    tooltip: templateDir,
    icon: new vscode.ThemeIcon('symbol-namespace'),
    command: existsSync(contextFile) ? openFileCommand(contextFile) : undefined,
    children: () => readDirectoryNodes(templateDir),
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

export function createConfigNode(path: string): BranchContextTreeNode {
  return {
    ...createFileNode(path, basename(path)),
    kind: 'config',
    icon: new vscode.ThemeIcon('settings-gear'),
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
    name === '.env' || name.startsWith('.env.') || name.endsWith('.pem') || name.endsWith('.key')
  );
}
