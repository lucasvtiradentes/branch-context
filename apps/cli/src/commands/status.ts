import {
  BranchContextStatusIssueLevel,
  BranchContextSymlinkState,
  CLI_NAME,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  getStatus,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  TEMPLATES_DIR,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { printTable } from '../helpers/branches';
import { requireGitRoot } from '../helpers/git-root';
import { green, red, yellow } from '../ui/color';

const STATUS_OK = green('[ok]');
const STATUS_ERROR = red('[!!]');
const STATUS_WARN = yellow('[--]');

export function registerStatusCommand(program: Program) {
  program.command('status', 'Show status, health, and branches').action(() => cmdStatus([]));
}

function cmdStatus(_args: string[]) {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const status = getStatus(gitRoot);

  if (!status.initialized) {
    console.log(`error: ${CLI_NAME} not initialized`);
    console.log(`run: ${CLI_NAME} init`);
    return 1;
  }

  console.log(`Mode:        ${status.mode}`);
  if (status.sharedPath) {
    console.log(`Storage:     ${status.sharedPath}`);
  }
  console.log(`Repo store:  ${status.repoStorageDir}`);
  console.log(`Templates:   ${status.templatesDir}`);
  console.log(`Branches:    ${status.branchesDir}`);
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
    console.log(`  ${STATUS_OK} ${TEMPLATES_DIR}/ exists`);
  } else {
    console.log(`  ${STATUS_ERROR} ${TEMPLATES_DIR}/ missing`);
  }

  if (status.defaultTemplateExists) {
    console.log(`  ${STATUS_OK} ${DEFAULT_TEMPLATE} template exists`);
  } else {
    console.log(`  ${STATUS_ERROR} ${DEFAULT_TEMPLATE} template missing`);
  }

  switch (status.symlink.state) {
    case BranchContextSymlinkState.Valid:
      console.log(`  ${STATUS_OK} symlink valid`);
      break;
    case BranchContextSymlinkState.Broken:
      console.log(`  ${STATUS_ERROR} symlink broken -> ${status.symlink.target}`);
      break;
    case BranchContextSymlinkState.NotSymlink:
      console.log(`  ${STATUS_ERROR} ${DEFAULT_SYMLINK} is not a symlink`);
      break;
    case BranchContextSymlinkState.Missing:
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

  return status.issues.some((issue) => issue.level === BranchContextStatusIssueLevel.Error) ? 1 : 0;
}
