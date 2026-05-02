import type { Program } from '@caporal/core';
import { cmdAgentsStatus } from './status';
import { cmdAgentsSync } from './sync';

export function registerAgentsCommands(program: Program): void {
  program.command('agents status', 'Show agent integration status').action(() => cmdAgentsStatus());

  program.command('agents sync', 'Sync agent sessions').action(() => cmdAgentsSync());
}

export { cmdAgentsStatus } from './status';
export { cmdAgentsSync } from './sync';
