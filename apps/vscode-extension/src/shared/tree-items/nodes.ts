import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import * as vscode from 'vscode';
import { CONTEXT_FILE_NAME } from '../../constants';
import { readDirectoryNodes } from './directory';
import { type BranchContextTreeNode, BranchContextTreeNodeKind } from './types';

export function createMessageNode(label: string): BranchContextTreeNode {
  return {
    label,
    kind: BranchContextTreeNodeKind.Message,
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
    kind: BranchContextTreeNodeKind.Group,
    description: options.description,
    icon: options.icon ?? new vscode.ThemeIcon('folder'),
    resourceUri: options.resourceUri,
    collapsibleState: options.collapsibleState,
    children: () => children,
  };
}

type GroupNodeOptions = {
  description?: string;
  icon?: vscode.TreeItem['iconPath'];
  resourceUri?: vscode.Uri;
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
    kind: BranchContextTreeNodeKind.Context,
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
    kind: BranchContextTreeNodeKind.Template,
    path,
    tooltip: path,
    icon: new vscode.ThemeIcon('symbol-namespace'),
    command: hasContextFile ? openFileCommand(contextFile) : undefined,
  };
}

export function createFileNode(path: string, label = basename(path)): BranchContextTreeNode {
  return {
    label,
    kind: BranchContextTreeNodeKind.File,
    path,
    tooltip: path,
    icon: new vscode.ThemeIcon('file'),
    command: openFileCommand(path),
  };
}

function openFileCommand(path: string): vscode.Command {
  return {
    command: 'vscode.open',
    title: 'Open',
    arguments: [vscode.Uri.file(path)],
  };
}
