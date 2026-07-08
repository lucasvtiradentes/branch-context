import {
  type BranchContextStatusIssue,
  BranchContextStatusIssueLevel,
  CONFIG_DIR,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { createGroupNode, createMessageNode, StateTreeProvider } from '../../../shared/tree-items';
import {
  type BranchContextTreeNode,
  BranchContextTreeNodeKind,
} from '../../../shared/tree-items/types';
import { branchContextState } from '../../../vscode/state';

export function createTemplatesProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = branchContextState.get();
    if (!state.initialized || !state.workspaceRoot || !state.status) {
      return [createMessageNode(`No ${CONFIG_DIR} config`)];
    }

    const currentContext = state.recentContexts.find((context) => context.current);
    return [
      createConfigNode('Mode', state.status.mode, getModeIcon(state.status.mode), {
        tooltip: state.status.globalPath ?? state.status.repoStorageDir,
        command: getModeCommand(state.status.mode),
      }),
      createConfigNode('Current branch', state.currentBranch ?? 'n/a', 'git-branch', {
        command: {
          command: commandIds.checkoutBranch,
          title: 'Checkout Branch',
        },
      }),
      createConfigNode('Base branch', state.status.baseBranch ?? 'n/a', 'git-compare', {
        command: {
          command: commandIds.setBase,
          title: 'Set Base Branch',
        },
      }),
      createConfigNode('Template', currentContext?.template ?? 'n/a', 'symbol-namespace', {
        command: {
          command: commandIds.applyTemplate,
          title: 'Apply Template',
        },
      }),
      ...getIssueNodes(state.status.issues),
    ];
  });
}

type ConfigNodeOptions = {
  tooltip?: string;
  command?: vscode.Command;
};

function createConfigNode(
  label: string,
  description: string,
  icon: string,
  options: ConfigNodeOptions = {},
): BranchContextTreeNode {
  return {
    label,
    description,
    kind: BranchContextTreeNodeKind.Message,
    tooltip: options.tooltip ?? description,
    icon: new vscode.ThemeIcon(icon),
    command: options.command,
  };
}

function getModeIcon(mode: 'local' | 'global') {
  return mode === 'global' ? 'cloud' : 'repo';
}

function getModeCommand(mode: 'local' | 'global'): vscode.Command | undefined {
  return mode === 'global'
    ? {
        command: commandIds.openGlobalStorage,
        title: 'Open Global Storage',
      }
    : undefined;
}

function getIssueNodes(issues: BranchContextStatusIssue[]) {
  if (issues.length === 0) {
    return [];
  }

  return [
    createGroupNode(
      'Issues',
      issues.map((issue) =>
        createConfigNode(
          issue.level,
          issue.message,
          issue.level === BranchContextStatusIssueLevel.Error ? 'error' : 'warning',
        ),
      ),
      {
        description: String(issues.length),
        icon: new vscode.ThemeIcon('warning'),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      },
    ),
  ];
}
