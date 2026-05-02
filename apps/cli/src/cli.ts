import { createRequire } from 'node:module';
import { CLI_NAME, DIST_NAME, VERSION } from '@branch-context/core';
import type { Program as CaporalProgram } from '@caporal/core';
import { registerAgentsCommands } from './commands/agents';
import { registerBaseCommand } from './commands/base';
import { registerInitCommand } from './commands/init';
import { registerOnCheckoutCommand } from './commands/on-checkout';
import { registerOnCommitCommand } from './commands/on-commit';
import { registerPruneCommand } from './commands/prune';
import { registerStatusCommand } from './commands/status';
import { registerSyncCommand } from './commands/sync';
import { registerTemplateCommand } from './commands/template';
import { registerUninstallCommand } from './commands/uninstall';

export function printHelp() {
  void createProgram().run(['--help']);
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const result = await createProgram().run(args);
    return typeof result === 'number' && result > 0 ? result : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`error: ${message}`);
    return 1;
  }
}

function createProgram(): CaporalProgram {
  const program = new (getProgramConstructor())()
    .bin(process.env.BCTX_PROG_NAME ?? CLI_NAME)
    .name(CLI_NAME)
    .description('Git branch context manager')
    .version(VERSION)
    .disableGlobalOption('-v')
    .disableGlobalOption('-V')
    .option('-v, --version', 'Show version', {
      global: true,
      action: () => {
        console.log(VERSION);
        return false;
      },
    });

  registerBaseCommand(program);
  registerInitCommand(program);
  registerUninstallCommand(program);
  registerSyncCommand(program);
  registerStatusCommand(program);
  registerAgentsCommands(program);
  registerPruneCommand(program);
  registerTemplateCommand(program);
  registerOnCheckoutCommand(program);
  registerOnCommitCommand(program);

  program.help(
    [
      'Examples:',
      `  ${CLI_NAME} init`,
      `  ${CLI_NAME} status`,
      `  ${CLI_NAME} agents status`,
      `  ${CLI_NAME} prune`,
      `  ${CLI_NAME} template`,
      `  ${CLI_NAME} template feature`,
      `  ${CLI_NAME} --install-completion`,
    ].join('\n'),
  );

  return program;
}

function getProgramConstructor() {
  const require = createRequire(import.meta.url);
  const module = require('@caporal/core') as {
    Program?: new () => CaporalProgram;
    default?: { Program?: new () => CaporalProgram };
  };
  const Program = module.Program ?? module.default?.Program;
  if (!Program) {
    throw new Error('Caporal Program constructor not found');
  }
  return Program;
}

export { DIST_NAME };
