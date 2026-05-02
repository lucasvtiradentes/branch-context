import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type AgentSession,
  type AgentSessionPin,
  getCurrentAgentsFilePath,
  isAgentSessionPin,
  readAgentsFile,
  removeAgentSessionPin as removeCoreAgentSessionPin,
  upsertAgentSessionPin as upsertCoreAgentSessionPin,
  writeAgentsFile,
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
    return agentsFile.pinnedSessions;
  }

  writeAgentsFile(path, {
    ...agentsFile,
    pinnedSessions: [...legacyPins, ...agentsFile.pinnedSessions],
  });
  removeLegacyAgentSessionPins(path);
  return readAgentsFile(path).pinnedSessions;
}

export function upsertAgentSessionPin(
  provider: AgentSession['provider'],
  sessionId: string,
  description: string,
): void {
  const path = getAgentsFilePath();
  if (!path) {
    return;
  }

  upsertCoreAgentSessionPin(path, {
    provider,
    sessionId,
    description,
  });
}

export function removeAgentSessionPin(provider: AgentSession['provider'], sessionId: string): void {
  const path = getAgentsFilePath();
  if (!path) {
    return;
  }

  removeCoreAgentSessionPin(path, provider, sessionId);
}

function getAgentsFilePath(): string | null {
  const workspaceRoot = branchContextState.get().workspaceRoot;
  return workspaceRoot ? getCurrentAgentsFilePath(workspaceRoot) : null;
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
