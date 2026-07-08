import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CLI_NAME } from '@branch-context/core';
import { IS_DEV_EXTENSION } from '../../constants';
import { logger } from '../../shared/logger';

const CLI_DETECTION_CACHE_MS = 30_000;
const DEV_CLI_NAME = 'bctxd';

type CliCommandCandidate = {
  command: string;
  label: string;
};

export type CliDetectionState = {
  installed: boolean;
  command: string | null;
  version: string | null;
  error: string | null;
};

const cliCommands = getCliCommandCandidates();

let cached: CliDetectionState | null = null;
let cachedAt = 0;

export function readCliDetection(): CliDetectionState {
  const now = Date.now();
  if (cached && now - cachedAt < CLI_DETECTION_CACHE_MS) {
    return cached;
  }

  cached = resolveCliDetection();
  cachedAt = now;
  return cached;
}

function resolveCliDetection(): CliDetectionState {
  const unreadableCommands: string[] = [];

  for (const command of cliCommands) {
    const result = spawnSync(command.command, ['--version'], {
      encoding: 'utf8',
      timeout: 2_000,
      windowsHide: true,
    });

    if (result.error) {
      logger.debug(`cli probe failed: command=${command.label} error=${result.error.message}`);
      continue;
    }

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const version = parseVersion(output);
    if (!version) {
      logger.warning(
        `cli version unreadable: command=${command.label} status=${result.status} output=${JSON.stringify(output.trim())}`,
      );
      unreadableCommands.push(command.label);
      continue;
    }

    logger.info(`cli detected: command=${command.label} version=${version}`);
    return {
      installed: true,
      command: command.label,
      version,
      error: null,
    };
  }

  if (unreadableCommands.length > 0) {
    return {
      installed: true,
      command: unreadableCommands[0] ?? null,
      version: null,
      error: 'CLI version could not be read',
    };
  }

  return {
    installed: false,
    command: null,
    version: null,
    error: 'CLI not found',
  };
}

function getCliCommandCandidates(): CliCommandCandidate[] {
  if (!IS_DEV_EXTENSION) {
    return [{ command: CLI_NAME, label: CLI_NAME }];
  }

  const commands: CliCommandCandidate[] = [{ command: DEV_CLI_NAME, label: DEV_CLI_NAME }];

  if (process.platform === 'win32') {
    commands.push({
      command: join(homedir(), 'AppData', 'Roaming', 'npm', `${DEV_CLI_NAME}.cmd`),
      label: DEV_CLI_NAME,
    });
  } else {
    commands.push({ command: join(homedir(), '.local', 'bin', DEV_CLI_NAME), label: DEV_CLI_NAME });
  }

  return commands;
}

function parseVersion(output: string): string | null {
  return output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/)?.[0] ?? null;
}
