import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type AgentSession,
  type AgentSessionPin,
  getAgentSessionPins,
  getBranchAgentsFilePath,
  getCurrentAgentsFilePath,
  isAgentSessionPin,
  readAgentsFile,
  removeAgentSessionPin as removeCoreAgentSessionPin,
  upsertAgentSessionPin as upsertCoreAgentSessionPin,
} from '@branch-context/core';
import { branchContextState } from '../../vscode/state';

const legacyPinsFileName = 'agent-session-pins.json';

export type { AgentSessionPin };

export function readAgentSessionPins(): AgentSessionPin[] {
  const path = getAgentsFilePath();
  if (!path) {
    return [];
  }

  const agentsFile = readAgentsFile(path);
  const legacyPins = readLegacyAgentSessionPins(path);
  if (legacyPins.length === 0) {
    return getAgentSessionPins(agentsFile);
  }

  let nextAgentsFile = agentsFile;
  for (const pin of legacyPins) {
    nextAgentsFile = upsertCoreAgentSessionPin(path, pin);
  }
  removeLegacyAgentSessionPins(path);
  return getAgentSessionPins(nextAgentsFile);
}

export function upsertAgentSessionPin(
  provider: AgentSession['provider'],
  sessionId: string,
  description: string,
  branch?: string,
  sourceAgentsFilePath?: string,
): void {
  const path = getAgentsFilePath(branch, sourceAgentsFilePath);
  if (!path) {
    return;
  }

  upsertCoreAgentSessionPin(path, {
    provider,
    sessionId,
    description,
  });
}

export function removeAgentSessionPin(
  provider: AgentSession['provider'],
  sessionId: string,
  branch?: string,
  sourceAgentsFilePath?: string,
): void {
  const path = getAgentsFilePath(branch, sourceAgentsFilePath);
  if (!path) {
    return;
  }

  removeCoreAgentSessionPin(path, provider, sessionId);
}

function getAgentsFilePath(branch?: string, sourceAgentsFilePath?: string): string | null {
  if (sourceAgentsFilePath) {
    return sourceAgentsFilePath;
  }

  const state = branchContextState.get();
  if (!state.workspaceRoot) {
    return null;
  }

  if (branch && branch !== state.currentBranch) {
    return getBranchAgentsFilePath(state.workspaceRoot, branch);
  }

  return getCurrentAgentsFilePath(state.workspaceRoot);
}

function readLegacyAgentSessionPins(agentsFilePath: string): AgentSessionPin[] {
  const path = getLegacyAgentSessionPinsFilePath(agentsFilePath);
  if (!existsSync(path)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { pins?: unknown };
    return Array.isArray(parsed.pins) ? parsed.pins.filter(isAgentSessionPin) : [];
  } catch {
    return [];
  }
}

function removeLegacyAgentSessionPins(agentsFilePath: string): void {
  const path = getLegacyAgentSessionPinsFilePath(agentsFilePath);
  if (!existsSync(path)) {
    return;
  }

  try {
    unlinkSync(path);
  } catch {}
}

function getLegacyAgentSessionPinsFilePath(agentsFilePath: string) {
  return join(dirname(agentsFilePath), legacyPinsFileName);
}
