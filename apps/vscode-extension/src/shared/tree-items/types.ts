import type { AgentSessionProvider, GitCommitSummary } from '@branch-context/core';
import * as vscode from 'vscode';

const archivedContextResourceScheme = 'branch-context-archived';
const inactiveAgentSessionResourceScheme = 'branch-context-inactive-agent';

export enum BranchContextTreeNodeKind {
  Message = 'message',
  File = 'file',
  Folder = 'folder',
  Group = 'group',
  Context = 'context',
  Template = 'template',
  Commit = 'commit',
  Agent = 'agent',
}

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
  agentProvider?: AgentSessionProvider;
  sessionId?: string;
  agentsFilePath?: string;
  pinned?: boolean;
  pinDescription?: string;
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

export type BranchContextTreeNodeDraft = Partial<BranchContextTreeNode>;

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

export function isDecoratedTreeItemResourceScheme(scheme: string): boolean {
  return scheme === archivedContextResourceScheme || scheme === inactiveAgentSessionResourceScheme;
}

export function getTreeItemResourceTooltip(scheme: string): string {
  return scheme === archivedContextResourceScheme
    ? 'Archived branch context'
    : 'Inactive agent session';
}
