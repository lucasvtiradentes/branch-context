import { cmdAgents } from './commands/agents';
import { cmdBase } from './commands/base';
import { cmdCompletion } from './commands/completion';
import { cmdInit } from './commands/init';
import { cmdOnCheckout } from './commands/on-checkout';
import { cmdOnCommit } from './commands/on-commit';
import { cmdPrune } from './commands/prune';
import { cmdStatus } from './commands/status';
import { cmdSync } from './commands/sync';
import { cmdTemplate } from './commands/template';
import { cmdUninstall } from './commands/uninstall';

type CommandInfo = {
  desc: string;
  args: string;
};

export const COMMANDS: Record<string, CommandInfo> = {
  base: { desc: 'Show or set base branch', args: '[branch]' },
  init: { desc: 'Initialize and install hook', args: '' },
  uninstall: { desc: 'Remove hook from current repo', args: '' },
  sync: { desc: 'Sync context and update meta/tags', args: '' },
  status: { desc: 'Show status, health, and branches', args: '' },
  agents: { desc: 'Manage AI agent session integration', args: '<command>' },
  prune: { desc: 'Archive orphan contexts and delete branches', args: '' },
  template: { desc: 'Apply template to current branch', args: '[name]' },
  completion: { desc: 'Generate shell completion', args: '<shell>' },
};

const INTERNAL_COMMANDS = new Set(['on-checkout', 'on-commit']);

type CommandHandler = (args: string[]) => number | Promise<number>;

const handlers: Record<string, CommandHandler> = {
  base: cmdBase,
  agents: cmdAgents,
  init: cmdInit,
  uninstall: cmdUninstall,
  sync: cmdSync,
  status: cmdStatus,
  prune: cmdPrune,
  'on-checkout': cmdOnCheckout,
  'on-commit': cmdOnCommit,
  template: cmdTemplate,
  completion: cmdCompletion,
};

export function getCommandHandler(name: string) {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown command: ${name}`);
  }
  return handler;
}

export function getAllCommandNames() {
  return new Set([...Object.keys(COMMANDS), ...INTERNAL_COMMANDS]);
}

export function getPublicCommands() {
  return COMMANDS;
}
