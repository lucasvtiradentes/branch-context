import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  archiveContextByKey,
  deleteContextByKey,
  restoreContextByKey,
  syncCurrentBranch,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, CONTEXT_FILE_NAME, commandIds } from '../constants';
import { formatLogError, logger } from '../core/logger';
import { formatError } from '../lib/format/error';
import { refreshBranchContextState } from '../state/state';
import {
  type BranchContextTreeNode,
  type BranchContextTreeNodeDraft,
  BranchContextTreeNodeKind,
} from '../views/items';
import { formatActionError, getInitializedState, openExternalFolder, openPath } from './helpers';

type ContextTreeNode = BranchContextTreeNode & {
  branch: string;
  branchKey: string;
  path: string;
};

type ContextWorkspace = {
  contextNode: ContextTreeNode;
  workspaceRoot: string;
};

export function registerContextActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.checkoutContextBranch, checkoutContextBranch),
    vscode.commands.registerCommand(commandIds.openContext, openContext),
    vscode.commands.registerCommand(commandIds.revealContextFolder, revealContextFolder),
    vscode.commands.registerCommand(commandIds.archiveContext, archiveContext),
    vscode.commands.registerCommand(commandIds.restoreContext, restoreContext),
    vscode.commands.registerCommand(commandIds.deleteContext, deleteContext),
  ];
}

async function checkoutContextBranch(node: unknown): Promise<void> {
  try {
    const context = await getContextWorkspace(node);
    if (!context) {
      return;
    }
    const { contextNode, workspaceRoot } = context;
    logger.info(
      `checkout context invoked: branch=${contextNode.branch} key=${contextNode.branchKey} workspace=${workspaceRoot}`,
    );

    if (contextNode.archived) {
      logger.warning(`checkout context aborted: archived branch=${contextNode.branch}`);
      await vscode.window.showErrorMessage(`${APP_NAME}: archived contexts cannot be checked out`);
      return;
    }

    if (contextNode.current) {
      logger.info(`checkout context skipped: already current branch=${contextNode.branch}`);
      await vscode.window.showInformationMessage(`${APP_NAME}: '${contextNode.branch}' is current`);
      return;
    }

    if (!contextNode.local) {
      logger.warning(`checkout context aborted: missing local branch=${contextNode.branch}`);
      await vscode.window.showErrorMessage(
        `${APP_NAME}: '${contextNode.branch}' is not a local branch`,
      );
      return;
    }

    const result = spawnSync('git', ['checkout', contextNode.branch], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      logger.warning(
        `checkout context failed: branch=${contextNode.branch} status=${result.status} stderr=${result.stderr.trim()} stdout=${result.stdout.trim()}`,
      );
      await vscode.window.showErrorMessage(
        `${APP_NAME}: checkout failed: ${result.stderr.trim() || result.stdout.trim()}`,
      );
      return;
    }

    const syncResult = syncCurrentBranch(workspaceRoot, { sound: false });
    if (!syncResult.ok) {
      logger.warning(
        `checkout context sync failed: reason=${syncResult.reason} branch=${syncResult.branch ?? 'none'} message=${syncResult.message}`,
      );
      await vscode.window.showErrorMessage(formatActionError(syncResult));
      return;
    }

    logger.info(
      [
        'checkout context synced:',
        `branch=${syncResult.branch}`,
        `base=${syncResult.baseBranch}`,
        `create=${syncResult.createResult}`,
        `symlink=${syncResult.symlinkResult}`,
        `updates=${syncResult.updates.length}`,
      ].join(' '),
    );
    refreshBranchContextState();
    await vscode.window.showInformationMessage(`${APP_NAME}: checked out '${contextNode.branch}'`);
  } catch (error) {
    logger.error(`checkout context error: ${formatLogError(error)}`);
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function openContext(node: unknown): Promise<void> {
  try {
    const contextNode = await getContextNode(node);
    if (!contextNode) {
      return;
    }

    const contextFile = join(contextNode.path, CONTEXT_FILE_NAME);
    if (!existsSync(contextFile)) {
      await vscode.window.showErrorMessage(`${APP_NAME}: context.md not found`);
      return;
    }

    await openPath(contextFile);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function revealContextFolder(node: unknown): Promise<void> {
  try {
    const contextNode = await getContextNode(node);
    if (!contextNode) {
      return;
    }

    await openExternalFolder(contextNode.path);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function archiveContext(node: unknown): Promise<void> {
  try {
    const context = await getContextWorkspace(node);
    if (!context) {
      return;
    }
    const { contextNode, workspaceRoot } = context;

    if (contextNode.current) {
      await vscode.window.showErrorMessage(`${APP_NAME}: current context cannot be archived`);
      return;
    }

    if (contextNode.archived) {
      await vscode.window.showInformationMessage(
        `${APP_NAME}: '${contextNode.branch}' is already archived`,
      );
      return;
    }

    const selected = await vscode.window.showWarningMessage(
      `${APP_NAME}: archive context for '${contextNode.branch}'?`,
      { modal: true },
      'Archive',
    );
    if (selected !== 'Archive') {
      return;
    }

    const result = archiveContextByKey(workspaceRoot, contextNode.branchKey);
    if (!result.ok) {
      await vscode.window.showErrorMessage(formatActionError(result));
      return;
    }

    refreshBranchContextState();
    await vscode.window.showInformationMessage(`${APP_NAME}: archived '${contextNode.branch}'`);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function restoreContext(node: unknown): Promise<void> {
  try {
    const context = await getContextWorkspace(node);
    if (!context) {
      return;
    }
    const { contextNode, workspaceRoot } = context;

    if (!contextNode.archived) {
      await vscode.window.showInformationMessage(
        `${APP_NAME}: '${contextNode.branch}' is already active`,
      );
      return;
    }

    const result = restoreContextByKey(workspaceRoot, contextNode.branchKey);
    if (!result.ok) {
      await vscode.window.showErrorMessage(formatActionError(result));
      return;
    }

    refreshBranchContextState();
    await vscode.window.showInformationMessage(`${APP_NAME}: restored '${contextNode.branch}'`);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function deleteContext(node: unknown): Promise<void> {
  try {
    const context = await getContextWorkspace(node);
    if (!context) {
      return;
    }
    const { contextNode, workspaceRoot } = context;

    if (contextNode.current) {
      await vscode.window.showErrorMessage(`${APP_NAME}: current context cannot be deleted`);
      return;
    }

    const selected = await vscode.window.showWarningMessage(
      `${APP_NAME}: permanently delete context for '${contextNode.branch}'?`,
      { modal: true },
      'Delete',
    );
    if (selected !== 'Delete') {
      return;
    }

    const result = deleteContextByKey(workspaceRoot, contextNode.branchKey, contextNode.archived);
    if (!result.ok) {
      await vscode.window.showErrorMessage(formatActionError(result));
      return;
    }

    refreshBranchContextState();
    await vscode.window.showInformationMessage(`${APP_NAME}: deleted '${contextNode.branch}'`);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function getContextWorkspace(node: unknown): Promise<ContextWorkspace | null> {
  const contextNode = await getContextNode(node);
  if (!contextNode) {
    return null;
  }

  const state = await getInitializedState();
  if (!state?.workspaceRoot) {
    return null;
  }

  return {
    contextNode,
    workspaceRoot: state.workspaceRoot,
  };
}

async function getContextNode(node: unknown): Promise<ContextTreeNode | null> {
  if (!isContextNode(node)) {
    await vscode.window.showErrorMessage(`${APP_NAME}: select a context row first`);
    return null;
  }

  return node;
}

function isContextNode(node: unknown): node is ContextTreeNode {
  if (!node || typeof node !== 'object') {
    return false;
  }

  const value = node as BranchContextTreeNodeDraft;
  return (
    value.kind === BranchContextTreeNodeKind.Context &&
    typeof value.branch === 'string' &&
    typeof value.branchKey === 'string' &&
    typeof value.path === 'string'
  );
}
