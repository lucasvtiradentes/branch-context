import { type AgentSession, getAgentSessions } from '@branch-context/core';
import type { Program } from '@caporal/core';
import { requireGitRoot } from '../../helpers/git-root';

type AgentSessionProviderSource = Pick<AgentSession, 'provider'>;

export function registerAgentsStatusCommand(program: Program) {
  program.command('agents status', 'Show agent integration status').action(() => cmdAgentsStatus());
}

function cmdAgentsStatus() {
  const gitRoot = requireGitRoot();
  if (!gitRoot) {
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

function formatProviders(sessions: AgentSessionProviderSource[]) {
  const providers = [...new Set(sessions.map((session) => session.provider))].sort();
  if (providers.length === 0) {
    return 'none';
  }
  return providers.join(', ');
}
