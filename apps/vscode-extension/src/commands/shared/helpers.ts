import {
  type BranchContextActionError,
  BranchContextActionErrorReason,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME } from '../../constants';
import { type BranchContextExtensionState, getBranchContextState } from '../../state/state';

const actionErrorMessages = {
  [BranchContextActionErrorReason.NotInitialized]: () => `${APP_NAME}: no .bctx config found`,
  [BranchContextActionErrorReason.NoCurrentBranch]: () =>
    `${APP_NAME}: could not determine current branch`,
  [BranchContextActionErrorReason.MissingContext]: (error: BranchContextActionError) =>
    `${APP_NAME}: no context for '${error.branch ?? 'current branch'}'. Run sync first.`,
  [BranchContextActionErrorReason.BaseBranchNotFound]: (error: BranchContextActionError) =>
    `${APP_NAME}: base branch not found: ${error.baseBranch ?? 'unknown'}`,
  [BranchContextActionErrorReason.NoTemplates]: () => `${APP_NAME}: no templates found`,
  [BranchContextActionErrorReason.TemplateNotFound]: (error: BranchContextActionError) =>
    `${APP_NAME}: ${error.message}`,
} as const satisfies Record<
  BranchContextActionErrorReason,
  (error: BranchContextActionError) => string
>;

export async function getInitializedState(): Promise<BranchContextExtensionState | null> {
  const state = getBranchContextState();
  if (!state.workspaceRoot) {
    await vscode.window.showErrorMessage(`${APP_NAME}: no workspace folder open`);
    return null;
  }

  if (!state.initialized) {
    await vscode.window.showErrorMessage(`${APP_NAME}: no .bctx config found`);
    return null;
  }

  return state;
}

export async function openPath(path: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
  await vscode.window.showTextDocument(document);
}

export async function openExternalFolder(path: string): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.file(path));
  if (!opened) {
    throw new Error(`${APP_NAME}: could not open folder`);
  }
}

export function formatActionError(error: BranchContextActionError): string {
  return actionErrorMessages[error.reason](error);
}
