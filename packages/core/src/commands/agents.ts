import { getGitRoot } from '../core/hooks';
import { getAgentSessions, syncAgentSessions } from '../services/agents';

export function cmdAgents(args: string[]): number {
  const [subcommand] = args;

  if (subcommand === 'status') {
    return cmdAgentsStatus();
  }

  if (subcommand === 'sync') {
    return cmdAgentsSync();
  }

  printAgentsHelp();
  return 1;
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

function cmdAgentsSync() {
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

function printAgentsHelp() {
  console.log(`usage:
  bctx agents status
  bctx agents sync`);
}

function formatProviders(sessions: Array<{ provider: string }>) {
  const providers = [...new Set(sessions.map((session) => session.provider))].sort();
  if (providers.length === 0) {
    return 'none';
  }
  return providers.join(', ');
}
