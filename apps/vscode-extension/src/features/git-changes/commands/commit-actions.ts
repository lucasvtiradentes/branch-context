import {
  type GitCommitSummary,
  gitCommitRemoteUrl,
  gitRestoreFromCommit,
  gitWorktreeDirty,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState } from '../../../shared/command-utils/helpers';
import { formatError } from '../../../shared/format/error';
import type { BranchContextTreeNodeDraft } from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';

export function registerCommitActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.copyCommitHash, copyCommitHash),
    vscode.commands.registerCommand(commandIds.openCommitOnOrigin, openCommitOnOrigin),
    vscode.commands.registerCommand(commandIds.resetFilesToCommit, resetFilesToCommit),
  ];
}

async function copyCommitHash(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  await vscode.env.clipboard.writeText(commit.hash);
}

async function openCommitOnOrigin(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  try {
    const state = await getInitializedState();
    if (!state?.workspaceRoot) {
      return;
    }

    const url = gitCommitRemoteUrl(state.workspaceRoot, commit.hash);
    if (!url) {
      await vscode.window.showErrorMessage(`${APP_NAME}: origin is not GitHub or GitLab`);
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function resetFilesToCommit(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  try {
    const state = await getInitializedState();
    if (!state?.workspaceRoot) {
      return;
    }

    const dirty = gitWorktreeDirty(state.workspaceRoot);
    const warning = dirty
      ? `This will overwrite current working tree changes with ${commit.shortHash}.`
      : `This will restore all files from ${commit.shortHash}.`;
    const confirmed = await vscode.window.showWarningMessage(
      `Reset Files To Commit? ${warning}`,
      { modal: true },
      'Reset Files',
    );
    if (confirmed !== 'Reset Files') {
      return;
    }

    const result = gitRestoreFromCommit(state.workspaceRoot, commit.hash);
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || 'git restore failed');
    }

    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

function getCommit(node: unknown): GitCommitSummary | null {
  const treeNode = node as BranchContextTreeNodeDraft | undefined;
  return treeNode?.commit ?? null;
}
