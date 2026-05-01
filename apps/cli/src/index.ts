#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export { addToGitignore } from '@branch-context/core';

import { runCli } from './cli';

export { runCli } from './cli';
export { cmdAgents } from './commands/agents';
export {
  getBashCompletion,
  getFishCompletion,
  getZshCompletion,
  safeFuncName,
} from './commands/completion';
export { cmdInit } from './commands/init';
export { cmdOnCheckout } from './commands/on-checkout';
export { cmdOnCommit } from './commands/on-commit';
export { cmdPrune } from './commands/prune';
export { cmdStatus } from './commands/status';
export { cmdTemplate } from './commands/template';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
