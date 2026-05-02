import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AgentSession, AgentSessionProvider } from '@branch-context/core';
import { branchContextState } from '../../vscode/state';

const pinsFileName = 'agent-session-pins.json';

export type AgentSessionPin = {
  provider: AgentSession['provider'];
  sessionId: string;
  description: string;
  pinnedAt: string;
};

type AgentSessionPinsFile = {
  version: 1;
  pins: AgentSessionPin[];
};

export function readAgentSessionPins(): AgentSessionPin[] {
  return readAgentSessionPinsFile(getAgentSessionPinsFilePath()).pins;
}

export function upsertAgentSessionPin(
  provider: AgentSession['provider'],
  sessionId: string,
  description: string,
): void {
  const path = getAgentSessionPinsFilePath();
  if (!path) {
    return;
  }

  const file = readAgentSessionPinsFile(path);
  const pins = file.pins.filter((pin) => pin.provider !== provider || pin.sessionId !== sessionId);
  pins.unshift({
    provider,
    sessionId,
    description,
    pinnedAt: new Date().toISOString(),
  });
  writeFileSync(path, `${JSON.stringify({ version: 1, pins }, null, 2)}\n`);
}

export function removeAgentSessionPin(provider: AgentSession['provider'], sessionId: string): void {
  const path = getAgentSessionPinsFilePath();
  if (!path) {
    return;
  }

  const file = readAgentSessionPinsFile(path);
  const pins = file.pins.filter((pin) => pin.provider !== provider || pin.sessionId !== sessionId);
  writeFileSync(path, `${JSON.stringify({ version: 1, pins }, null, 2)}\n`);
}

function getAgentSessionPinsFilePath(): string | null {
  const workspaceRoot = branchContextState.get().workspaceRoot;
  return workspaceRoot ? join(workspaceRoot, '_branch', pinsFileName) : null;
}

function readAgentSessionPinsFile(path: string | null): AgentSessionPinsFile {
  if (!path || !existsSync(path)) {
    return { version: 1, pins: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AgentSessionPinsFile>;
    return {
      version: 1,
      pins: Array.isArray(parsed.pins) ? parsed.pins.filter(isAgentSessionPin) : [],
    };
  } catch {
    return { version: 1, pins: [] };
  }
}

function isAgentSessionPin(value: unknown): value is AgentSessionPin {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const pin = value as Partial<AgentSessionPin>;
  return (
    (pin.provider === AgentSessionProvider.Claude || pin.provider === AgentSessionProvider.Codex) &&
    typeof pin.sessionId === 'string' &&
    typeof pin.description === 'string' &&
    typeof pin.pinnedAt === 'string'
  );
}
