import * as vscode from 'vscode';
import { branchContextState } from '../../vscode/state';
import type { BranchContextTreeNode } from './types';

export class StateTreeProvider
  implements vscode.TreeDataProvider<BranchContextTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<BranchContextTreeNode | undefined>();
  private readonly stateDisposable = branchContextState.onDidChange(() => this.refresh());

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
    item.id = node.id;
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
