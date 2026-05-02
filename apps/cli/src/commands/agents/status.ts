import { getAgentSessions, getGitRoot } from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerAgentsStatusCommand(program: Program) {
  program.command('agents status', 'Show agent integration status').action(() => cmdAgentsStatus());
}

function cmdAgentsStatus() {
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

function formatProviders(sessions: Array<{ provider: string }>) {
  const providers = [...new Set(sessions.map((session) => session.provider))].sort();
  if (providers.length === 0) {
    return 'none';
  }
  return providers.join(', ');
}
