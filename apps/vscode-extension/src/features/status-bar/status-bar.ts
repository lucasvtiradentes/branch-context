import { BranchContextStatusIssueLevel, initProject } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds, STATUS_BAR_PRIORITY } from '../../constants';
import { formatError } from '../../shared/format/error';
import { escapeMarkdown, markdownTooltipLine } from '../../shared/format/markdown';
import { formatRelativeTime } from '../../shared/format/relative-time';
import { logger } from '../../shared/logger';
import { type BranchContextExtensionState, branchContextState } from '../../vscode/state';

const PROMPT_YES = 'Yes';
const PROMPT_NO = 'No';

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
  context.subscriptions.push(branchContextState.onDidChange(updateStatusBar));
  updateStatusBar(branchContextState.get());
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
    const state = branchContextState.get();
    logger.info(
      `status bar clicked: workspace=${state.workspaceRoot ?? 'none'} initialized=${state.initialized} branch=${state.currentBranch ?? 'none'} contextFile=${state.currentContextFile ?? 'none'}`,
    );
    if (!state.initialized) {
      await promptInitProject(state);
      return;
    }

    await vscode.commands.executeCommand(commandIds.openCurrentContext);
  } catch (error) {
    logger.error(`status bar action error: ${logger.formatError(error)}`);
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
    PROMPT_YES,
    PROMPT_NO,
  );
  if (selected !== PROMPT_YES) {
    logger.info(`init prompt dismissed: selected=${selected ?? 'none'}`);
    return;
  }

  logger.info(`init project started: workspace=${state.workspaceRoot}`);
  const result = await initProject(state.workspaceRoot, async (question) => {
    logger.warning(`init hook prompt shown: question=${question}`);
    const answer = await vscode.window.showWarningMessage(
      question,
      { modal: true },
      PROMPT_YES,
      PROMPT_NO,
    );
    logger.warning(`init hook prompt answered: answer=${answer ?? 'none'}`);
    return answer === PROMPT_YES;
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
  branchContextState.refresh();
  await vscode.window.showInformationMessage(`${APP_NAME}: initialized`);
}

enum StatusBarState {
  Synced = 'synced',
  NotSynced = 'notSynced',
  Warning = 'warning',
  Error = 'error',
}

const statusIcons = {
  [StatusBarState.Synced]: '$(check)',
  [StatusBarState.NotSynced]: '$(warning)',
  [StatusBarState.Warning]: '$(warning)',
  [StatusBarState.Error]: '$(error)',
} as const satisfies Record<StatusBarState, string>;
const statusLabels = {
  [StatusBarState.Synced]: StatusBarState.Synced,
  [StatusBarState.NotSynced]: 'not synced',
  [StatusBarState.Warning]: StatusBarState.Warning,
  [StatusBarState.Error]: StatusBarState.Error,
} as const satisfies Record<StatusBarState, string>;

function getStatusBarState(state: BranchContextExtensionState): StatusBarState {
  if (!state.initialized) {
    return StatusBarState.Error;
  }

  if (state.status?.issues.some((issue) => issue.level === BranchContextStatusIssueLevel.Error)) {
    return StatusBarState.Error;
  }

  if (!state.currentContextFile) {
    return StatusBarState.NotSynced;
  }

  if (state.status?.issues.some((issue) => issue.level === BranchContextStatusIssueLevel.Warning)) {
    return StatusBarState.Warning;
  }

  return StatusBarState.Synced;
}

function getStatusText(status: StatusBarState): string {
  return `${getStatusIcon(status)} bctx`;
}

function getStatusIcon(status: StatusBarState): string {
  return statusIcons[status];
}

function getAccessibilityLabel(state: BranchContextExtensionState): string {
  return `${APP_NAME}: ${getStatusLabel(getStatusBarState(state))}`;
}

function getStatusLabel(status: StatusBarState): string {
  return statusLabels[status];
}

function getTooltip(state: BranchContextExtensionState): vscode.MarkdownString {
  const status = getStatusBarState(state);
  if (!state.initialized) {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(
      [
        '**Branch Context**',
        '',
        markdownTooltipLine('Status', getStatusLabel(status)),
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
      markdownTooltipLine('Status', getStatusLabel(status)),
      markdownTooltipLine('Branch', state.currentBranch ?? 'n/a'),
      markdownTooltipLine('Base', state.status?.baseBranch ?? 'n/a'),
      markdownTooltipLine('Template', currentContext?.template ?? 'n/a'),
      markdownTooltipLine('Updated', formatRelativeTime(currentContext?.updatedAt ?? null)),
      markdownTooltipLine('Commits', String(currentContext?.commitCount ?? 0)),
      markdownTooltipLine('Files', String(currentContext?.changedFileCount ?? 0)),
      ...getIssueTooltipLines(state),
    ].join('\n\n'),
  );
  return tooltip;
}

function getIssueTooltipLines(state: BranchContextExtensionState): string[] {
  const issues = state.status?.issues ?? [];
  if (issues.length === 0) {
    return [];
  }

  return [
    '',
    '**Issues:**',
    ...issues.map(
      (issue) =>
        `${issue.level === BranchContextStatusIssueLevel.Error ? '$(error)' : '$(warning)'} ${escapeMarkdown(issue.message)}`,
    ),
  ];
}
