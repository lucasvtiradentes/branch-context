import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { getBranchContextState, refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import type { BranchContextTreeNode } from '../tree-views/items';

type CachedAgentSession = {
  provider: 'claude' | 'codex';
  sessionId: string;
};

type CachedAgentsFile = {
  version: 1;
  sessions: CachedAgentSession[];
};

export function registerAgentSessionActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.copyAgentSessionId, copyAgentSessionId),
    vscode.commands.registerCommand(commandIds.deleteAgentSession, deleteAgentSession),
  ];
}

async function copyAgentSessionId(node: unknown): Promise<void> {
  const session = node as Partial<BranchContextTreeNode> | undefined;
  if (!session?.sessionId) {
    await vscode.window.showErrorMessage('Missing agent session id.');
    return;
  }

  await vscode.env.clipboard.writeText(session.sessionId);
}

async function deleteAgentSession(node: unknown): Promise<void> {
  const session = node as Partial<BranchContextTreeNode> | undefined;
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
    removeCachedAgentSession(session.agentProvider, session.sessionId);
    await vscode.commands.executeCommand(commandIds.syncAgents);
    refreshBranchContextState();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

function removeCachedAgentSession(provider: 'claude' | 'codex', sessionId: string): void {
  const state = getBranchContextState();
  if (!state.workspaceRoot) {
    return;
  }

  const agentsFilePath = join(state.workspaceRoot, '_branch', 'agents.json');
  const agentsFile = readCachedAgentsFile(agentsFilePath);
  const sessions = agentsFile.sessions.filter(
    (session) => session.provider !== provider || session.sessionId !== sessionId,
  );

  writeFileSync(agentsFilePath, `${JSON.stringify({ ...agentsFile, sessions }, null, 2)}\n`);
}

function readCachedAgentsFile(path: string): CachedAgentsFile {
  if (!existsSync(path)) {
    return { version: 1, sessions: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CachedAgentsFile>;
    return {
      version: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter(isCachedAgentSession) : [],
    };
  } catch {
    return { version: 1, sessions: [] };
  }
}

function isCachedAgentSession(value: unknown): value is CachedAgentSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<CachedAgentSession>;
  return (
    (session.provider === 'claude' || session.provider === 'codex') &&
    typeof session.sessionId === 'string'
  );
}
