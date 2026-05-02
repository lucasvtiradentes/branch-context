import { CLI_NAME, Config, getGitRoot, playSound, syncCurrentBranch } from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerSyncCommand(program: Program) {
  program.command('sync', 'Sync context and update meta/tags').action(() => cmdSync([]));
}

export function cmdSync(_args: string[]) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  const config = Config.load(gitRoot);
  const result = syncCurrentBranch(gitRoot, {
    sound: config.sound,
    playSound,
  });
  if (!result.ok) {
    if (result.reason === 'not_initialized') {
      console.log(`error: not initialized. Run '${CLI_NAME} init' first`);
    } else if (result.reason === 'no_current_branch') {
      console.log('error: could not determine current branch');
    } else {
      console.log(`error: ${result.message}`);
    }
    return 1;
  }

  console.log(`Branch:  ${result.branch}`);
  console.log(`Context: ${result.contextDir}`);
  console.log(`Symlink: ${result.symlinkPath} -> ${result.contextDir}`);
  console.log(`Base:    ${result.baseBranch}`);

  if (result.createResult === 'created_from_template') {
    console.log('Status:  created from template');
  } else if (result.createResult === 'repaired_from_template') {
    console.log('Status:  repaired from template');
  } else if (result.createResult === 'created_empty') {
    console.log('Status:  created (no template)');
  } else {
    console.log('Status:  synced');
  }

  if (result.updates.length > 0) {
    console.log(`Updated: ${result.updates.length} tag(s)`);
  }

  return 0;
}
