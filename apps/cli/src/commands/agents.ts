import { getAgentSessions, getGitRoot, syncAgentSessions } from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerAgentsCommands(program: Program): void {
  program.command('agents status', 'Show agent integration status').action(() => cmdAgentsStatus());

  program.command('agents sync', 'Sync agent sessions').action(() => cmdAgentsSync());
}

export function cmdAgentsStatus() {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.log('error: not a git repository');
    return 1;
  }

  const result = getAgentSessions(gitRoot);
  if (!result.ok) {
    console.log(`error: ${result.message}`);
    return 1;
  }

  console.log(`Branch:       ${result.branch}`);
  console.log(`Agents file:  ${result.agentsFilePath ?? 'none'}`);
  console.log(`Sessions:     ${result.sessions.length}`);
  console.log(`Providers:    ${formatProviders(result.sessions)}`);
  return 0;
}

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

function formatProviders(sessions: Array<{ provider: string }>) {
  const providers = [...new Set(sessions.map((session) => session.provider))].sort();
  if (providers.length === 0) {
    return 'none';
  }
  return providers.join(', ');
}
