import { syncAgentSessions } from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../../helpers/git-root';

export function registerAgentsSyncCommand(program: Program) {
  program.command('agents sync', 'Sync agent sessions').action(() => cmdAgentsSync());
}

function cmdAgentsSync() {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
    return 1;
  }

  const result = syncAgentSessions(gitRoot);
  if (!result.ok) {
    console.log(`error: ${result.message}`);
    return 1;
  }

  console.log(`Synced agents: ${result.sessions.length}`);
  console.log(`Written:       ${result.written ? result.agentsFilePath : 'no'}`);
  return 0;
}
