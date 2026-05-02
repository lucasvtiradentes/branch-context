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
import { removeAgentSessionPin, upsertAgentSessionPin } from '../pins';

export function registerAgentSessionActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.pinAgentSession, pinAgentSession),
    vscode.commands.registerCommand(commandIds.unpinAgentSession, unpinAgentSession),
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
    prompt: 'Session description',
    value: session.pinDescription,
  });
  if (!description?.trim()) {
    return;
  }

  try {
    upsertAgentSessionPin(
      session.agentProvider,
      session.sessionId,
      description.trim(),
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
    `Unpin agent session ${session.pinDescription ?? session.sessionId.slice(0, 7)}?`,
    { modal: true },
    'Unpin',
  );
  if (confirmed !== 'Unpin') {
    return;
  }

  try {
    removeAgentSessionPin(
      session.agentProvider,
      session.sessionId,
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
  if (!state.workspaceRoot) {
    return;
  }

  const agentsFilePath =
    sourceAgentsFilePath ??
    (branch && branch !== state.currentBranch
      ? getBranchAgentsFilePath(state.workspaceRoot, branch)
      : getCurrentAgentsFilePath(state.workspaceRoot));
  const agentsFile = readAgentsFile(agentsFilePath);
  const sessions = agentsFile.sessions.filter(
    (session) => session.provider !== provider || session.sessionId !== sessionId,
  );

  writeAgentsFile(agentsFilePath, { ...agentsFile, sessions });
}
