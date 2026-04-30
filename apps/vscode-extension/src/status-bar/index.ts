import * as vscode from 'vscode';
import { commandIds, STATUS_BAR_MAX_CONTEXT_LENGTH, STATUS_BAR_PRIORITY } from '../constants';
import {
  type BranchContextExtensionState,
  getBranchContextState,
  onDidChangeState,
} from '../core/state';

let item: vscode.StatusBarItem | undefined;

export function initializeStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_PRIORITY);
  item.command = commandIds.openCurrentContext;
  context.subscriptions.push(item);
  context.subscriptions.push(onDidChangeState(updateStatusBar));
  updateStatusBar(getBranchContextState());
}

function updateStatusBar(state: BranchContextExtensionState): void {
  if (!item) {
    return;
  }

  if (!state.initialized) {
    item.hide();
    return;
  }

  const label = truncateContextLabel(state.currentBranch ?? 'no branch');
  item.text = `$(git-branch) bctx: ${label}`;
  item.tooltip = getTooltip(state);
  item.show();
}

function truncateContextLabel(value: string): string {
  if (value.length <= STATUS_BAR_MAX_CONTEXT_LENGTH) {
    return value;
  }

  return `${value.slice(0, STATUS_BAR_MAX_CONTEXT_LENGTH - 3)}...`;
}

function getTooltip(state: BranchContextExtensionState): string {
  const currentContext = state.recentContexts.find((context) => context.current);
  return [
    `Branch: ${state.currentBranch ?? 'n/a'}`,
    `Base: ${state.status?.baseBranch ?? 'n/a'}`,
    `Context: ${state.currentContextFile ?? state.currentContextDir ?? 'n/a'}`,
    `Last updated: ${currentContext?.updatedAt ?? 'n/a'}`,
  ].join('\n');
}
