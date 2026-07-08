#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLI_NAME, VERSION } from '@branch-context/core';
import type { Program as CaporalProgram } from '@caporal/core';
import { registerBackupCommand } from './commands/backup';
import { registerBaseCommand } from './commands/base';
import { registerCompletionCommand } from './commands/completion';
import { registerInitCommand, runInitCommand } from './commands/init';
import { registerOnCheckoutCommand } from './commands/on-checkout';
import { registerOnCommitCommand } from './commands/on-commit';
import { registerPruneCommand } from './commands/prune';
import { registerSetupCommand } from './commands/setup';
import { registerStatusCommand } from './commands/status';
import { registerSyncCommand } from './commands/sync';
import { registerTemplateCommand } from './commands/template';
import { registerUninstallCommand } from './commands/uninstall';

let programInstance: CaporalProgram | undefined;
let programInstanceBin: string | undefined;
let originalCwdRestored = false;

export async function runCli(args = process.argv.slice(2)) {
  try {
    restoreOriginalCwd();
    if (args[0] === 'init' && !args.includes('--help') && !args.includes('-h')) {
      return await runInitCommand(args);
    }
    const result = await getProgram().run(args.length === 0 ? ['--help'] : args);
    return typeof result === 'number' && result > 0 ? result : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`error: ${message}`);
    return 1;
  }
}

function restoreOriginalCwd() {
  if (originalCwdRestored || !process.env.BCTX_ORIGINAL_CWD) {
    return;
  }

  originalCwdRestored = true;
  process.chdir(process.env.BCTX_ORIGINAL_CWD);
}

function getProgram(): CaporalProgram {
  const binName = getProgramBin();
  if (!programInstance || programInstanceBin !== binName) {
    programInstance = createProgram(binName);
    programInstanceBin = binName;
  }
  return programInstance;
}

if (isDirectRun()) {
  const exitCode = await runCli();
  process.exit(exitCode);
}

function createProgram(binName: string): CaporalProgram {
  const program = new (getProgramConstructor())()
    .bin(binName)
    .name(binName)
    .description('Git branch context manager')
    .version(VERSION)
    .disableGlobalOption('--no-color')
    .disableGlobalOption('--quiet')
    .disableGlobalOption('--silent')
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
  registerSetupCommand(program);
  registerInitCommand(program);
  registerUninstallCommand(program);
  registerSyncCommand(program);
  registerBackupCommand(program);
  registerStatusCommand(program);
  registerPruneCommand(program);
  registerTemplateCommand(program);
  registerOnCheckoutCommand(program);
  registerOnCommitCommand(program);
  registerCompletionCommand(program);

  program.help(
    [
      'Examples:',
      `  ${binName} setup`,
      `  ${binName} init`,
      `  ${binName} status`,
      `  ${binName} backup`,
      `  ${binName} prune`,
      `  ${binName} template apply`,
      `  ${binName} template apply fix`,
      `  ${binName} --install-completion`,
    ].join('\n'),
  );

  return program;
}

function getProgramBin() {
  if (process.env.BCTX_PROG_NAME) {
    return process.env.BCTX_PROG_NAME;
  }
  if (isDirectRun() && process.argv[1]) {
    return basename(process.argv[1]);
  }
  return CLI_NAME;
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
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
