import {
  archiveBranch,
  CLI_NAME,
  collectBranchInfo,
  configExists,
  getCurrentBranch,
  getGitRoot,
  gitDeleteBranch,
  green,
  listArchivedBranches,
  multiSelect,
  red,
  sanitizeBranchName,
  yellow,
} from '@branch-context/core';
import type { Program } from '@caporal/core';
import { printTable } from './_branches';

export function registerPruneCommand(program: Program) {
  program
    .command('prune', 'Archive orphan contexts and delete branches')
    .action(() => cmdPrune([]));
}

export async function cmdPrune(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  if (!configExists(gitRoot)) {
    console.log(`error: not initialized. Run '${CLI_NAME} init' first`);
    return 1;
  }

  const allNames = collectBranchInfo(gitRoot);
  const current = getCurrentBranch(gitRoot);
  const currentSanitized = current ? sanitizeBranchName(current) : null;

  const noLocal = Array.from(allNames.entries())
    .filter(([, info]) => info.context && !info.local && info.sanitized !== currentSanitized)
    .map(([name]) => name);

  const deletable = Array.from(allNames.entries())
    .filter(
      ([name, info]) =>
        info.local &&
        !info.remote &&
        info.sanitized !== currentSanitized &&
        name !== 'main' &&
        name !== 'master',
    )
    .map(([name]) => name);

  if (noLocal.length === 0 && deletable.length === 0) {
    console.log('Nothing to prune');
    return 0;
  }

  console.log(`Branch contexts (${allNames.size}):\n`);
  printTable(allNames, current);

  const archived = listArchivedBranches(gitRoot);
  if (archived.length > 0) {
    console.log(`\nArchived: ${archived.length}`);
  }

  let toDelete: string[] = [];
  if (deletable.length > 0) {
    const deletableSorted = [...deletable].sort();
    console.log(`\nSelect ${yellow('local branches')} to delete:`);
    const labels = deletableSorted.map((name) => {
      const remoteStatus = allNames.get(name)?.remote ? green('remote: ✓') : red('remote: ✗');
      return `${name}  ${remoteStatus}`;
    });
    const selected = await multiSelect(deletableSorted, labels);
    toDelete = selected.flatMap((index) => {
      const branch = deletableSorted[index];
      return branch ? [branch] : [];
    });
  }

  const deleted: string[] = [];
  if (toDelete.length > 0) {
    console.log(`\nDeleting ${toDelete.length} local branch(es):\n`);
    for (const name of [...toDelete].sort()) {
      if (gitDeleteBranch(gitRoot, name, true)) {
        console.log(`  ${name}`);
        deleted.push(name);
      } else {
        console.log(`  ${name} (${red('failed')})`);
      }
    }
  }

  for (const name of deleted) {
    const info = allNames.get(name);
    if (info?.context && !noLocal.includes(name)) {
      noLocal.push(name);
    }
  }

  let toArchive: string[] = [];
  if (noLocal.length > 0) {
    const noLocalSorted = [...noLocal].sort();
    console.log(`\nSelect ${yellow('orphan contexts')} to archive:`);
    const selectedArchive = await multiSelect(noLocalSorted);
    toArchive = selectedArchive.flatMap((index) => {
      const branch = noLocalSorted[index];
      return branch ? [branch] : [];
    });
  }

  if (toArchive.length === 0 && deleted.length === 0) {
    console.log('\nNothing to do.');
    return 0;
  }

  if (toArchive.length > 0) {
    console.log(`\nArchiving ${toArchive.length} context(s):\n`);
    for (const name of [...toArchive].sort()) {
      const sanitized = allNames.get(name)?.sanitized;
      if (sanitized && archiveBranch(gitRoot, sanitized)) {
        console.log(`  ${name}`);
      }
    }
  }

  console.log(`\nDone. Use '${CLI_NAME} status' to see current contexts.`);
  return 0;
}
