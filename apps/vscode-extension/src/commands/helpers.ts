import type { BranchContextActionError } from '@branch-context/core/services/actions';
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

export function formatActionError(error: BranchContextActionError): string {
  if (error.reason === 'not_initialized') {
    return `${APP_NAME}: no .bctx config found`;
  }

  if (error.reason === 'no_current_branch') {
    return `${APP_NAME}: could not determine current branch`;
  }

  if (error.reason === 'missing_context') {
    return `${APP_NAME}: no context for '${error.branch ?? 'current branch'}'. Run sync first.`;
  }

  if (error.reason === 'no_templates') {
    return `${APP_NAME}: no templates found`;
  }

  if (error.reason === 'template_not_found') {
    return `${APP_NAME}: ${error.message}`;
  }

  return `${APP_NAME}: ${error.message}`;
}
