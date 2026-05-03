import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CLI_NAME, DIST_NAME, VERSION } from '@branch-context/core';
import { IS_DEV_EXTENSION } from '../../constants';
import { logger } from '../../shared/logger';

const CLI_COMPATIBILITY_CACHE_MS = 30_000;
const DEV_CLI_NAME = 'bctxd';
const CLI_PACKAGE_NAME = ['branch', 'context'].join('-');
const CLI_UPDATE_COMMAND = `npm install -g ${CLI_PACKAGE_NAME}@latest`;
const DEV_CLI_UPDATE_COMMAND = `pnpm --dir '__BCTX_REPO_ROOT__' --filter ${CLI_PACKAGE_NAME} bctxd:install`;

type CliCommandCandidate = {
  command: string;
  label: string;
};

export type CliCompatibilityState = {
  expectedVersion: string;
  installed: boolean;
  compatible: boolean;
  mismatch: CliCompatibilityMismatch;
  command: string | null;
  version: string | null;
  error: string | null;
  updateCommand: string;
};

export enum CliCompatibilityMismatch {
  None = 'none',
  Missing = 'missing',
  Unreadable = 'unreadable',
  CliOlder = 'cliOlder',
  CliNewer = 'cliNewer',
}

const cliCommands = getCliCommandCandidates();

let cached: CliCompatibilityState | null = null;
let cachedAt = 0;

export function readCliCompatibility(): CliCompatibilityState {
  const now = Date.now();
  if (cached && now - cachedAt < CLI_COMPATIBILITY_CACHE_MS) {
    return cached;
  }

  cached = resolveCliCompatibility();
  cachedAt = now;
  return cached;
}

function resolveCliCompatibility(): CliCompatibilityState {
  const unreadableVersions: string[] = [];

  for (const command of cliCommands) {
    const result = spawnSync(command.command, ['--version'], {
      encoding: 'utf8',
      timeout: 2_000,
      windowsHide: true,
    });

    if (result.error) {
      logger.debug(
        `cli compatibility probe failed: command=${command.label} error=${result.error.message}`,
      );
      continue;
    }

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const version = parseVersion(output);
    if (!version) {
      logger.warning(
        `cli compatibility version unreadable: command=${command.label} status=${result.status} output=${JSON.stringify(output.trim())}`,
      );
      unreadableVersions.push(command.label);
      continue;
    }

    const mismatch = getVersionMismatch(version, VERSION);
    const compatible = IS_DEV_EXTENSION || mismatch !== CliCompatibilityMismatch.CliOlder;
    logger.info(
      `cli compatibility resolved: command=${command.label} version=${version} expected=${VERSION} compatible=${compatible}`,
    );

    return {
      expectedVersion: VERSION,
      installed: true,
      compatible,
      mismatch: IS_DEV_EXTENSION ? CliCompatibilityMismatch.None : mismatch,
      command: command.label,
      version,
      error: compatible ? null : getVersionMismatchError(mismatch, version, VERSION),
      updateCommand: getCliUpdateCommand(),
    };
  }

  if (unreadableVersions.length > 0) {
    return {
      expectedVersion: VERSION,
      installed: true,
      compatible: false,
      mismatch: CliCompatibilityMismatch.Unreadable,
      command: unreadableVersions[0] ?? null,
      version: null,
      error: 'CLI version could not be read',
      updateCommand: getCliUpdateCommand(),
    };
  }

  return {
    expectedVersion: VERSION,
    installed: false,
    compatible: false,
    mismatch: CliCompatibilityMismatch.Missing,
    command: null,
    version: null,
    error: 'CLI not found',
    updateCommand: getCliUpdateCommand(),
  };
}

function getCliCommandCandidates(): CliCommandCandidate[] {
  if (!IS_DEV_EXTENSION) {
    return [
      { command: CLI_NAME, label: CLI_NAME },
      { command: DIST_NAME, label: DIST_NAME },
    ];
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

function getCliUpdateCommand() {
  return IS_DEV_EXTENSION ? DEV_CLI_UPDATE_COMMAND : CLI_UPDATE_COMMAND;
}

function parseVersion(output: string): string | null {
  return output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/)?.[0] ?? null;
}

function getVersionMismatch(version: string, expectedVersion: string): CliCompatibilityMismatch {
  const comparison = compareVersions(version, expectedVersion);
  if (comparison === 0) {
    return CliCompatibilityMismatch.None;
  }

  return comparison < 0 ? CliCompatibilityMismatch.CliOlder : CliCompatibilityMismatch.CliNewer;
}

function getVersionMismatchError(
  mismatch: CliCompatibilityMismatch,
  version: string,
  expectedVersion: string,
): string {
  if (mismatch === CliCompatibilityMismatch.CliOlder) {
    return `CLI ${version} is older than extension minimum ${expectedVersion}`;
  }

  return `CLI ${version} does not satisfy extension minimum ${expectedVersion}`;
}

function compareVersions(left: string, right: string): number {
  const [leftMajor, leftMinor, leftPatch] = getVersionParts(left);
  const [rightMajor, rightMinor, rightPatch] = getVersionParts(right);
  const majorDifference = leftMajor - rightMajor;
  if (majorDifference !== 0) {
    return majorDifference;
  }

  const minorDifference = leftMinor - rightMinor;
  if (minorDifference !== 0) {
    return minorDifference;
  }

  const patchDifference = leftPatch - rightPatch;
  if (patchDifference !== 0) {
    return patchDifference;
  }

  return 0;
}

function getVersionParts(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0), Number(match?.[3] ?? 0)];
}
