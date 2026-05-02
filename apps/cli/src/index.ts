#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export { addToGitignore } from '@branch-context/core';

import { runCli } from './cli';

export { runCli } from './cli';
export { cmdAgentsStatus, cmdAgentsSync, registerAgentsCommands } from './commands/agents';
export { cmdBase, registerBaseCommand } from './commands/base';
export { cmdInit, registerInitCommand } from './commands/init';
export { cmdOnCheckout, registerOnCheckoutCommand } from './commands/on-checkout';
export { cmdOnCommit, registerOnCommitCommand } from './commands/on-commit';
export { cmdPrune, registerPruneCommand } from './commands/prune';
export { cmdStatus, registerStatusCommand } from './commands/status';
export { cmdSync, registerSyncCommand } from './commands/sync';
export { cmdTemplate, registerTemplateCommand } from './commands/template';
export { cmdUninstall, registerUninstallCommand } from './commands/uninstall';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
