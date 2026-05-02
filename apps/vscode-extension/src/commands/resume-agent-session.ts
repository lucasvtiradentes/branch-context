import { AgentSessionProvider } from '@branch-context/core';
import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { markAgentSessionTerminalActive } from '../core/active-agent-sessions';
import type { BranchContextTreeNodeDraft } from '../tree-views/items';

const resumeCommandBuilders: Record<AgentSessionProvider, (sessionId: string) => string> = {
  [AgentSessionProvider.Claude]: (sessionId) =>
    `"${process.env.HOME ?? '~'}/.local/bin/claude" --dangerously-skip-permissions --resume ${shellQuote(sessionId)}`,
  [AgentSessionProvider.Codex]: (sessionId) =>
    `codex --dangerously-bypass-approvals-and-sandbox resume ${shellQuote(sessionId)}`,
};

export function registerResumeAgentSessionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.resumeAgentSession, async (node) => {
    const session = node as BranchContextTreeNodeDraft | undefined;
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
  return resumeCommandBuilders[provider](sessionId);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
