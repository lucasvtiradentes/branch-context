import {
  getCodexHookStatus,
  installCodexMetadataHook,
  uninstallCodexMetadataHook,
} from '../core/codex-hooks';
import { getGitRoot } from '../core/hooks';
import {
  type CaptureCodexSessionResult,
  type CodexHookInput,
  captureCodexSession,
  syncAgentSessions,
} from '../services/agents';

export async function cmdAgents(args: string[], readInput = readStdin): Promise<number> {
  const [subcommand, provider] = args;

  if (subcommand === 'status') {
    return cmdAgentsStatus();
  }

  if (subcommand === 'sync') {
    return cmdAgentsSync();
  }

  if (subcommand === 'install' && provider === 'codex') {
    return cmdAgentsInstallCodex();
  }

  if (subcommand === 'uninstall' && provider === 'codex') {
    return cmdAgentsUninstallCodex();
  }

  if (subcommand === 'codex-hook') {
    return cmdAgentsCodexHook(readInput);
  }

  printAgentsHelp();
  return 1;
}

function cmdAgentsStatus() {
  const status = getCodexHookStatus(getCodexHookOptions());
  console.log(`Codex hook: ${status.installed ? 'installed' : 'not installed'}`);
  console.log(`Hooks:      ${status.hooksPath}`);
  console.log(`Config:     ${status.configPath}`);
  return status.installed ? 0 : 1;
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

function cmdAgentsInstallCodex() {
  const status = installCodexMetadataHook(getCodexHookOptions());
  console.log(`Codex hook: ${status.installed ? 'installed' : 'not installed'}`);
  console.log(`Hooks:      ${status.hooksPath}`);
  console.log(`Config:     ${status.configPath}`);
  return status.installed ? 0 : 1;
}

function cmdAgentsUninstallCodex() {
  const status = uninstallCodexMetadataHook(getCodexHookOptions());
  console.log(`Codex hook: ${status.installed ? 'installed' : 'not installed'}`);
  console.log(`Hooks:      ${status.hooksPath}`);
  console.log(`Config:     ${status.configPath}`);
  return status.installed ? 1 : 0;
}

async function cmdAgentsCodexHook(readInput: () => Promise<string>) {
  const input = parseHookInput(await readInput());
  const result = captureCodexSession(input);
  const output = formatCodexHookOutput(result);
  if (output) {
    console.log(output);
  }
  return 0;
}

export function formatCodexHookOutput(result: CaptureCodexSessionResult) {
  if (!result.metadata) {
    return '';
  }

  const context = `BCTX_SESSION_METADATA:\n${JSON.stringify(result.metadata)}`;
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  });
}

function parseHookInput(input: string): CodexHookInput {
  try {
    const data = JSON.parse(input) as Record<string, unknown>;
    return {
      session_id: asString(data.session_id),
      transcript_path: asString(data.transcript_path),
      model: asString(data.model),
      source: data.source,
      cwd: asString(data.cwd),
      timestamp: asString(data.timestamp),
    };
  } catch {
    return {};
  }
}

function getCodexHookOptions() {
  return {
    hooksPath: process.env.BCTX_CODEX_HOOKS_PATH,
    configPath: process.env.BCTX_CODEX_CONFIG_PATH,
  };
}

function printAgentsHelp() {
  console.log(`usage:
  bctx agents status
  bctx agents sync
  bctx agents install codex
  bctx agents uninstall codex`);
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
