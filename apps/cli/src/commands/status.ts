import {
  CLI_NAME,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  getGitRoot,
  getStatus,
  green,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  red,
  yellow,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { printTable } from '../helpers/branches';

const STATUS_OK = green('[ok]');
const STATUS_ERROR = red('[!!]');
const STATUS_WARN = yellow('[--]');

export function registerStatusCommand(program: Program) {
  program.command('status', 'Show status, health, and branches').action(() => cmdStatus([]));
}

function cmdStatus(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  const status = getStatus(gitRoot);

  if (!status.initialized) {
    console.log(`error: ${CLI_NAME} not initialized`);
    console.log(`run: ${CLI_NAME} init`);
    return 1;
  }

  console.log(`Branch:      ${status.currentBranch}`);
  console.log(`Base:        ${status.baseBranch}`);

  console.log(
    `Templates:   ${status.templates.length > 0 ? [...status.templates].sort().join(', ') : 'none'}`,
  );

  console.log();
  console.log('Health:');

  if (status.hooks.checkout) {
    console.log(`  ${STATUS_OK} ${HOOK_POST_CHECKOUT} hook installed`);
  } else {
    console.log(`  ${STATUS_ERROR} ${HOOK_POST_CHECKOUT} hook not installed`);
  }

  if (status.hooks.commit) {
    console.log(`  ${STATUS_OK} ${HOOK_POST_COMMIT} hook installed`);
  } else {
    console.log(`  ${STATUS_ERROR} ${HOOK_POST_COMMIT} hook not installed`);
  }

  if (status.templatesDirExists) {
    console.log(`  ${STATUS_OK} templates/ exists`);
  } else {
    console.log(`  ${STATUS_ERROR} templates/ missing`);
  }

  if (status.defaultTemplateExists) {
    console.log(`  ${STATUS_OK} ${DEFAULT_TEMPLATE} template exists`);
  } else {
    console.log(`  ${STATUS_ERROR} ${DEFAULT_TEMPLATE} template missing`);
  }

  switch (status.symlink.state) {
    case 'valid':
      console.log(`  ${STATUS_OK} symlink valid`);
      break;
    case 'broken':
      console.log(`  ${STATUS_ERROR} symlink broken -> ${status.symlink.target}`);
      break;
    case 'not_symlink':
      console.log(`  ${STATUS_ERROR} ${DEFAULT_SYMLINK} is not a symlink`);
      break;
    case 'missing':
      console.log(`  ${STATUS_WARN} symlink not set`);
      break;
  }

  const orphans = Array.from(status.contexts.entries()).filter(
    ([, info]) => info.context && !info.local,
  );
  if (orphans.length > 0) {
    console.log(`  ${STATUS_WARN} ${orphans.length} orphan contexts`);
  } else {
    console.log(`  ${STATUS_OK} no orphan contexts`);
  }

  if (status.contexts.size > 0) {
    const contextCount = Array.from(status.contexts.values()).filter((info) => info.context).length;
    console.log(`\nBranches (${contextCount} contexts, ${status.archivedCount} archived):\n`);
    printTable(status.contexts, status.currentBranch);
  }

  return status.issues.some((issue) => issue.level === 'error') ? 1 : 0;
}
