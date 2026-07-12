import { existsSync } from 'node:fs';
import {
  type AgentSessionProvider,
  getBranchAgentsFilePath,
  getCurrentAgentsFilePath,
  readAgentsFile,
  writeAgentsFile,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import type { BranchContextTreeNodeDraft } from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';
import { updateAgentSessionDescription, updateAgentSessionPinnedAt } from '../metadata';

export function registerAgentSessionActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.pinAgentSession, pinAgentSession),
    vscode.commands.registerCommand(commandIds.unpinAgentSession, unpinAgentSession),
    vscode.commands.registerCommand(commandIds.renameAgentSession, renameAgentSession),
    vscode.commands.registerCommand(commandIds.copyAgentSessionId, copyAgentSessionId),
    vscode.commands.registerCommand(commandIds.deleteAgentSession, deleteAgentSession),
  ];
}

async function pinAgentSession(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  if (!session?.agentProvider || !session.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session metadata.');
    return;
  }

  const description = await vscode.window.showInputBox({
    title: 'Pin agent session',
    prompt: 'Session name (optional)',
    placeHolder: session.sessionDisplayText,
    value: session.sessionDescription ?? '',
  });
  if (description == null) {
    return;
  }

  try {
    updateAgentSessionDescription(
      session.agentProvider,
      session.sessionId,
      description.trim() || null,
      session.branch,
      session.agentsFilePath,
    );
    updateAgentSessionPinnedAt(
      session.agentProvider,
      session.sessionId,
      new Date().toISOString(),
      session.branch,
      session.agentsFilePath,
    );
    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function unpinAgentSession(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  if (!session?.agentProvider || !session.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session metadata.');
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Unpin agent session ${session.sessionDescription ?? session.sessionId.slice(0, 7)}?`,
    { modal: true },
    'Unpin',
  );
  if (confirmed !== 'Unpin') {
    return;
  }

  try {
    updateAgentSessionPinnedAt(
      session.agentProvider,
      session.sessionId,
      null,
      session.branch,
      session.agentsFilePath,
    );
    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function renameAgentSession(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  if (!session?.agentProvider || !session.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session metadata.');
    return;
  }

  const description = await vscode.window.showInputBox({
    title: 'Rename agent session',
    prompt: 'Custom session name. Leave empty to clear.',
    placeHolder: session.sessionDisplayText,
    value: session.sessionDescription ?? '',
  });
  if (description == null) {
    return;
  }

  try {
    updateAgentSessionDescription(
      session.agentProvider,
      session.sessionId,
      description.trim() || null,
      session.branch,
      session.agentsFilePath,
    );
    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function copyAgentSessionId(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  if (!session?.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session id.');
    return;
  }

  await vscode.env.clipboard.writeText(session.sessionId);
}

async function deleteAgentSession(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  if (!session?.agentProvider || !session.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session metadata.');
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Delete agent session ${session.sessionId.slice(0, 7)}?`,
    { modal: true },
    'Delete',
  );
  if (confirmed !== 'Delete') {
    return;
  }

  try {
    if (session.path && existsSync(session.path)) {
      await vscode.workspace.fs.delete(vscode.Uri.file(session.path));
    }
    removeCachedAgentSession(
      session.agentProvider,
      session.sessionId,
      session.branch,
      session.agentsFilePath,
    );
    await vscode.commands.executeCommand(commandIds.syncAgents);
    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

function removeCachedAgentSession(
  provider: AgentSessionProvider,
  sessionId: string,
  branch?: string,
  sourceAgentsFilePath?: string,
): void {
  const state = branchContextState.get();
  if (!state.workspaceRoot || !state.initialized) {
    return;
  }

  const agentsFilePath =
    sourceAgentsFilePath ??
    (branch && branch !== state.currentBranch
      ? getBranchAgentsFilePath(state.workspaceRoot, branch)
      : getCurrentAgentsFilePath(state.workspaceRoot));
  const agentsFile = readAgentsFile(agentsFilePath);
  const sessions = agentsFile.filter(
    (session) => session.provider !== provider || session.sessionId !== sessionId,
  );

  writeAgentsFile(agentsFilePath, sessions);
}
