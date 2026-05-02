import { getGitRoot, syncAgentSessions } from '@branch-context/core';

export function cmdAgentsSync() {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
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
