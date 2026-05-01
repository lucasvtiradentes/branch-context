import { initProject } from '@branch-context/core/services/actions';
import * as vscode from 'vscode';
import { APP_NAME, commandIds, STATUS_BAR_PRIORITY } from '../constants';
import {
  type BranchContextExtensionState,
  getBranchContextState,
  onDidChangeState,
  refreshBranchContextState,
} from '../core/state';
import { formatError } from '../lib/format-error';
import { formatLogError, logger } from '../lib/logging';

let item: vscode.StatusBarItem | undefined;

export function initializeStatusBar(context: vscode.ExtensionContext): void {
  logger.info('status bar initialized');
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
  item.command = commandIds.showStatusBarActions;
  item.name = APP_NAME;
  context.subscriptions.push(item);
  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.showStatusBarActions, showStatusBarActions),
  );
  context.subscriptions.push(onDidChangeState(updateStatusBar));
  updateStatusBar(getBranchContextState());
}

function updateStatusBar(state: BranchContextExtensionState): void {
  if (!item) {
    return;
  }

  if (!state.workspaceRoot) {
    item.hide();
    return;
  }

  const status = getStatusBarState(state);
  item.text = getStatusText(status);
  item.tooltip = getTooltip(state);
  item.backgroundColor = undefined;
  item.accessibilityInformation = {
    label: getAccessibilityLabel(state),
    role: 'button',
  };
  item.show();
}

async function showStatusBarActions(): Promise<void> {
  try {
    const state = getBranchContextState();
    logger.info(
      `status bar clicked: workspace=${state.workspaceRoot ?? 'none'} initialized=${state.initialized} branch=${state.currentBranch ?? 'none'} contextFile=${state.currentContextFile ?? 'none'}`,
    );
    if (!state.initialized) {
      await promptInitProject(state);
      return;
    }

    await vscode.commands.executeCommand(commandIds.openCurrentContext);
  } catch (error) {
    logger.error(`status bar action error: ${formatLogError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function promptInitProject(state: BranchContextExtensionState): Promise<void> {
  if (!state.workspaceRoot) {
    logger.warning('init prompt aborted: no workspace');
    return;
  }

  logger.info(`init prompt shown: workspace=${state.workspaceRoot}`);
  const selected = await vscode.window.showInformationMessage(
    'Do you want to init bctx in the current project?',
    'Yes',
    'No',
  );
  if (selected !== 'Yes') {
    logger.info(`init prompt dismissed: selected=${selected ?? 'none'}`);
    return;
  }

  logger.info(`init project started: workspace=${state.workspaceRoot}`);
  const result = await initProject(state.workspaceRoot, async (question) => {
    logger.warning(`init hook prompt shown: question=${question}`);
    const answer = await vscode.window.showWarningMessage(question, { modal: true }, 'Yes', 'No');
    logger.warning(`init hook prompt answered: answer=${answer ?? 'none'}`);
    return answer === 'Yes';
  });
  if (!result.ok) {
    logger.warning(`init project failed: reason=${result.reason} message=${result.message}`);
    await vscode.window.showErrorMessage(`${APP_NAME}: ${result.message}`);
    return;
  }

  logger.info(
    [
      'init project result:',
      `alreadyInitialized=${result.alreadyInitialized}`,
      `checkoutHook=${result.checkoutHook}`,
      `commitHook=${result.commitHook}`,
      `syncOk=${result.syncResult.ok}`,
    ].join(' '),
  );
  refreshBranchContextState();
  await vscode.window.showInformationMessage(`${APP_NAME}: initialized`);
}

type StatusBarState = 'synced' | 'notSynced' | 'warning' | 'error';

function getStatusBarState(state: BranchContextExtensionState): StatusBarState {
  if (!state.initialized) {
    return 'error';
  }

  if (state.status?.issues.some((issue) => issue.level === 'error')) {
    return 'error';
  }

  if (!state.currentContextFile) {
    return 'notSynced';
  }

  if (state.status?.issues.some((issue) => issue.level === 'warning')) {
    return 'warning';
  }

  return 'synced';
}

function getStatusText(status: StatusBarState): string {
  return `${getStatusIcon(status)} bctx`;
}

function getStatusIcon(status: StatusBarState): string {
  if (status === 'error') {
    return '$(error)';
  }

  if (status === 'warning' || status === 'notSynced') {
    return '$(warning)';
  }

  return '$(check)';
}

function getAccessibilityLabel(state: BranchContextExtensionState): string {
  return `${APP_NAME}: ${getStatusLabel(getStatusBarState(state))}`;
}

function getStatusLabel(status: StatusBarState): string {
  if (status === 'notSynced') {
    return 'not synced';
  }

  return status;
}

function getTooltip(state: BranchContextExtensionState): vscode.MarkdownString {
  const status = getStatusBarState(state);
  if (!state.initialized) {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(
      [
        '**Branch Context**',
        '',
        tooltipLine('Status', getStatusLabel(status)),
        '',
        'Do you want to init bctx in the current project?',
      ].join('\n\n'),
    );
    return tooltip;
  }

  const currentContext = state.recentContexts.find((context) => context.current);
  const tooltip = new vscode.MarkdownString();
  tooltip.supportThemeIcons = true;
  tooltip.appendMarkdown(
    [
      '**Branch Context**',
      '',
      tooltipLine('Status', getStatusLabel(status)),
      tooltipLine('Branch', state.currentBranch ?? 'n/a'),
      tooltipLine('Base', state.status?.baseBranch ?? 'n/a'),
      tooltipLine('Template', currentContext?.template ?? 'n/a'),
      tooltipLine('Updated', currentContext?.updatedAt ?? 'n/a'),
      tooltipLine('Commits', String(currentContext?.commitCount ?? 0)),
      tooltipLine('Files', String(currentContext?.changedFileCount ?? 0)),
      tooltipLine('Context', state.currentContextFile ?? state.currentContextDir ?? 'n/a'),
    ].join('\n\n'),
  );
  return tooltip;
}

function tooltipLine(label: string, value: string): string {
  return `**${label}:** ${escapeMarkdown(value)}`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}
