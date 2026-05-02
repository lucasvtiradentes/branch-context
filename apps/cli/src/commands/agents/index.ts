import type { Program } from '@caporal/core';
import { registerAgentsStatusCommand } from './status';
import { registerAgentsSyncCommand } from './sync';

export function registerAgentsCommands(program: Program): void {
  registerAgentsStatusCommand(program);
  registerAgentsSyncCommand(program);
}
