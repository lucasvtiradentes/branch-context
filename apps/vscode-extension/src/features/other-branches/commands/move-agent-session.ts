import { moveAgentSessionToBranch } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { formatError } from '../../../shared/format/error';
import { logger } from '../../../shared/logger';
import type { BranchContextTreeNodeDraft } from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';
import { suppressAgentSessionFileActivity } from '../../agent-sessions/active';

export function registerMoveAgentSessionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.moveAgentSessionToBranch, moveAgentSession);
}

async function moveAgentSession(node: unknown): Promise<void> {
  const session = node as BranchContextTreeNodeDraft | undefined;
  const state = branchContextState.get();
  if (!state.workspaceRoot || !session?.agentProvider || !session.sessionId || !session.branch) {
    await vscode.window.showErrorMessage('Missing agent session metadata.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    state.recentContexts
      .filter((context) => context.branch !== session.branch)
      .map((context) => ({
        label: context.branch,
        description: context.current ? 'current' : undefined,
      })),
    {
      title: 'Move agent session to branch',
      placeHolder: 'Select target branch',
    },
  );
  if (!selected) {
    return;
  }

  try {
    if (session.path) {
      suppressAgentSessionFileActivity(session.path, 'move-agent-session');
    }
    logger.debug(
      `[move-agent-session] start provider=${session.agentProvider} session=${session.sessionId} from=${session.branch} to=${selected.label} path=${session.path ?? 'none'} agentsFile=${session.agentsFilePath ?? 'default'}`,
    );
    const result = moveAgentSessionToBranch({
      repoRoot: state.workspaceRoot,
      provider: session.agentProvider,
      sessionId: session.sessionId,
      fromBranch: session.branch,
      toBranch: selected.label,
      fromAgentsFilePath: session.agentsFilePath,
    });
    if (!result.ok) {
      logger.warning(
        `[move-agent-session] failed provider=${session.agentProvider} session=${session.sessionId} reason=${result.reason} message=${result.message}`,
      );
      await vscode.window.showErrorMessage(`${APP_NAME}: ${result.message}`);
      return;
    }

    logger.info(
      `[move-agent-session] moved provider=${session.agentProvider} session=${session.sessionId} to=${selected.label} patchedLines=${result.patchedLines}`,
    );
    branchContextState.refresh();
    await vscode.window.showInformationMessage(`${APP_NAME}: moved session to ${selected.label}`);
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}
