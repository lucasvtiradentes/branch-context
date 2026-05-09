import {
  type AgentSession,
  getBranchAgentsFilePath,
  getCurrentAgentsFilePath,
  updateAgentSessionMetadata as updateCoreAgentSessionMetadata,
} from '@branch-context/core';
import { branchContextState } from '../../vscode/state';

export function updateAgentSessionDescription(
  provider: AgentSession['provider'],
  sessionId: string,
  description: string | null,
  branch?: string,
  sourceAgentsFilePath?: string,
): void {
  const path = getAgentsFilePath(branch, sourceAgentsFilePath);
  if (!path) {
    return;
  }

  updateCoreAgentSessionMetadata(path, provider, sessionId, { description });
}

export function updateAgentSessionPinnedAt(
  provider: AgentSession['provider'],
  sessionId: string,
  pinnedAt: string | null,
  branch?: string,
  sourceAgentsFilePath?: string,
): void {
  const path = getAgentsFilePath(branch, sourceAgentsFilePath);
  if (!path) {
    return;
  }

  updateCoreAgentSessionMetadata(path, provider, sessionId, { pinnedAt });
}

function getAgentsFilePath(branch?: string, sourceAgentsFilePath?: string): string | null {
  if (sourceAgentsFilePath) {
    return sourceAgentsFilePath;
  }

  const state = branchContextState.get();
  if (!state.workspaceRoot || !state.initialized) {
    return null;
  }

  if (branch && branch !== state.currentBranch) {
    return getBranchAgentsFilePath(state.workspaceRoot, branch);
  }

  return getCurrentAgentsFilePath(state.workspaceRoot);
}
