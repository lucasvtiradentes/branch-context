import {
  BranchContextStatusIssueLevel,
  type InitProjectOptions,
  initProject,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds, STATUS_BAR_PRIORITY } from '../constants';
import { formatError } from '../shared/format/error';
import { escapeMarkdown, markdownTooltipLine } from '../shared/format/markdown';
import { logger } from '../shared/logger';
import { CliCompatibilityMismatch } from './cli/compatibility';
import { type BranchContextExtensionState, branchContextState } from './state';

const PROMPT_YES = 'Yes';
const PROMPT_NO = 'No';
const PROMPT_INSTALL_HOOKS = 'Install Hooks';
const PROMPT_UPDATE_CLI = 'Update CLI';
const PROMPT_IGNORE = 'Ignore';

let item: vscode.StatusBarItem | undefined;
let cliCompatibilityPromptShown = false;
let extensionVersion = 'unknown';

export function initializeStatusBar(context: vscode.ExtensionContext): void {
  logger.info('status bar initialized');
  extensionVersion = getExtensionVersion(context);
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
  item.command = commandIds.showStatusBarActions;
  item.name = APP_NAME;
  context.subscriptions.push(item);
  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.showStatusBarActions, showStatusBarActions),
  );
  context.subscriptions.push(
    branchContextState.onDidChange((state) => {
      updateStatusBar(state);
      void maybePromptCliCompatibilityIssue(state);
    }),
  );
  const state = branchContextState.get();
  updateStatusBar(state);
  void maybePromptCliCompatibilityIssue(state);
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
    if (!state.cliCompatibility.compatible) {
      await promptCliUpdate(state);
      return;
    }

    if (!state.initialized) {
      await promptInitProject(state);
      return;
    }

    if (hasMissingHooks(state)) {
      await promptInstallHooks(state);
      return;
    }

    await vscode.commands.executeCommand(commandIds.openCurrentContext);
  } catch (error) {
    logger.error(`status bar action error: ${logger.formatError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}

function hasMissingHooks(state: BranchContextExtensionState): boolean {
  return (
    state.initialized &&
    !!state.status &&
    (!state.status.hooks.checkout || !state.status.hooks.commit)
  );
}

async function promptInstallHooks(state: BranchContextExtensionState): Promise<void> {
  if (!state.workspaceRoot) {
    logger.warning('install hooks prompt aborted: no workspace');
    return;
  }

  const selected = await vscode.window.showWarningMessage(
    `${APP_NAME}: Git hooks are not installed. Install them now?`,
    PROMPT_INSTALL_HOOKS,
    PROMPT_IGNORE,
  );
  if (selected !== PROMPT_INSTALL_HOOKS) {
    logger.info(`install hooks prompt dismissed: selected=${selected ?? 'none'}`);
    return;
  }

  logger.info(`install hooks started: workspace=${state.workspaceRoot}`);
  const result = await initProject(
    state.workspaceRoot,
    async (question) => {
      logger.info(`install hooks prompt shown: question=${question}`);
      const answer = await promptYesNoInput('Configure Git Hooks', question);
      logger.info(`install hooks prompt answered: answer=${answer}`);
      return answer;
    },
    {
      hookCommandName: state.cliCompatibility.command,
    },
  );
  if (!result.ok) {
    logger.warning(`install hooks failed: reason=${result.reason} message=${result.message}`);
    await vscode.window.showErrorMessage(`${APP_NAME}: ${result.message}`);
    return;
  }

  branchContextState.refresh();
  await vscode.window.showInformationMessage(`${APP_NAME}: hooks installed`);
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

  const initOptions = promptInitOptions();

  logger.info(`init project started: workspace=${state.workspaceRoot}`);
  const result = await initProject(
    state.workspaceRoot,
    async (question) => {
      logger.info(`init hook prompt shown: question=${question}`);
      const answer = await promptYesNoInput('Configure Git Hooks', question);
      logger.info(`init hook prompt answered: answer=${answer}`);
      return answer;
    },
    {
      ...initOptions,
      hookCommandName: state.cliCompatibility.command,
    },
  );
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

function promptInitOptions(): InitProjectOptions {
  return {};
}

async function promptYesNoInput(title: string, placeHolder: string): Promise<boolean> {
  const selected = await vscode.window.showQuickPick([PROMPT_YES, PROMPT_NO], {
    title,
    placeHolder,
    ignoreFocusOut: true,
  });
  return selected === PROMPT_YES;
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
  if (!state.cliCompatibility.compatible) {
    return StatusBarState.Error;
  }

  if (!state.initialized) {
    return StatusBarState.Error;
  }

  if (state.status?.issues.some((issue) => issue.level === BranchContextStatusIssueLevel.Error)) {
    return StatusBarState.Error;
  }

  if (state.cliCompatibility.mismatch === CliCompatibilityMismatch.CliNewer) {
    return StatusBarState.Warning;
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
  const currentContext = state.recentContexts.find((context) => context.current);
  const tooltip = new vscode.MarkdownString();
  tooltip.supportThemeIcons = true;
  tooltip.appendMarkdown(
    [
      markdownTooltipLine('Extension', extensionVersion),
      ...getCliCompatibilityTooltipLines(state),
      markdownTooltipLine('Branch', state.currentBranch ?? 'n/a'),
      markdownTooltipLine('Base', state.status?.baseBranch ?? 'n/a'),
      markdownTooltipLine('Template', currentContext?.template ?? 'n/a'),
      ...getIssueTooltipLines(state),
    ].join('\n\n'),
  );
  return tooltip;
}

function getExtensionVersion(context: vscode.ExtensionContext): string {
  const packageJson = context.extension.packageJSON;
  return typeof packageJson === 'object' &&
    packageJson !== null &&
    'version' in packageJson &&
    typeof packageJson.version === 'string'
    ? packageJson.version
    : 'unknown';
}

function getCliCompatibilityTooltipLines(state: BranchContextExtensionState): string[] {
  const cli = state.cliCompatibility;
  if (cli.compatible) {
    const lines = [markdownTooltipLine('CLI', `${cli.command ?? 'bctx'} ${cli.version}`)];
    if (cli.mismatch === CliCompatibilityMismatch.CliNewer) {
      lines.push(
        `$(warning) ${escapeMarkdown(`CLI ${cli.version ?? 'unknown'} is newer than extension version ${cli.expectedVersion}`)}`,
      );
    }
    return lines;
  }

  return [
    markdownTooltipLine('CLI', cli.installed ? (cli.version ?? 'unknown') : 'not found'),
    markdownTooltipLine('Expected CLI', cli.expectedVersion),
    `${cli.installed ? '$(error)' : '$(warning)'} ${escapeMarkdown(cli.error ?? 'CLI mismatch')}`,
  ];
}

async function maybePromptCliCompatibilityIssue(state: BranchContextExtensionState): Promise<void> {
  if (cliCompatibilityPromptShown || !state.workspaceRoot || state.cliCompatibility.compatible) {
    return;
  }

  cliCompatibilityPromptShown = true;
  await promptCliUpdate(state);
}

async function promptCliUpdate(state: BranchContextExtensionState): Promise<void> {
  const message = getCliCompatibilityPromptMessage(state);
  const selected = await vscode.window.showWarningMessage(
    message,
    PROMPT_UPDATE_CLI,
    PROMPT_IGNORE,
  );
  if (selected !== PROMPT_UPDATE_CLI) {
    return;
  }

  await vscode.commands.executeCommand(commandIds.updateCli);
}

function getCliCompatibilityPromptMessage(state: BranchContextExtensionState): string {
  const cli = state.cliCompatibility;
  if (!cli.installed) {
    return `${APP_NAME}: CLI not found`;
  }

  if (cli.mismatch === CliCompatibilityMismatch.CliOlder) {
    return `${APP_NAME}: CLI version ${cli.version ?? 'unknown'} is older than extension version ${cli.expectedVersion}`;
  }

  return `${APP_NAME}: ${cli.error ?? 'CLI version could not be read'}`;
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
