import { AgentSessionProvider } from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { markAgentSessionTerminalActive } from '../core/active-agent-sessions';
import type { BranchContextTreeNode } from '../tree-views/items';

export function registerResumeAgentSessionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.resumeAgentSession, async (node) => {
    const session = node as Partial<BranchContextTreeNode> | undefined;
    if (!session?.agentProvider || !session.sessionId) {
      await vscode.window.showErrorMessage('Missing agent session metadata.');
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: `bctx ${session.agentProvider} ${session.sessionId.slice(0, 7)}`,
    });
    terminal.show();
    markAgentSessionTerminalActive(terminal, {
      provider: session.agentProvider,
      sessionId: session.sessionId,
      path: session.path ?? null,
    });
    terminal.sendText(getResumeCommand(session.agentProvider, session.sessionId));
  });
}

function getResumeCommand(provider: AgentSessionProvider, sessionId: string) {
  if (provider === AgentSessionProvider.Claude) {
    return `"${process.env.HOME ?? '~'}/.local/bin/claude" --dangerously-skip-permissions --resume ${shellQuote(sessionId)}`;
  }

  return `codex --dangerously-bypass-approvals-and-sandbox resume ${shellQuote(sessionId)}`;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
