import {
  type BranchContextActionError,
  BranchContextActionErrorReason,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME } from '../constants';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';

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
  if (error.reason === BranchContextActionErrorReason.NotInitialized) {
    return `${APP_NAME}: no .bctx config found`;
  }

  if (error.reason === BranchContextActionErrorReason.NoCurrentBranch) {
    return `${APP_NAME}: could not determine current branch`;
  }

  if (error.reason === BranchContextActionErrorReason.MissingContext) {
    return `${APP_NAME}: no context for '${error.branch ?? 'current branch'}'. Run sync first.`;
  }

  if (error.reason === BranchContextActionErrorReason.BaseBranchNotFound) {
    return `${APP_NAME}: base branch not found: ${error.baseBranch ?? 'unknown'}`;
  }

  if (error.reason === BranchContextActionErrorReason.NoTemplates) {
    return `${APP_NAME}: no templates found`;
  }

  if (error.reason === BranchContextActionErrorReason.TemplateNotFound) {
    return `${APP_NAME}: ${error.message}`;
  }

  return `${APP_NAME}: ${error.message}`;
}
