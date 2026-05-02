import { spawnSync } from 'node:child_process';
import { CLI_NAME, DIST_NAME, VERSION } from '@branch-context/core';

const CLI_COMPATIBILITY_CACHE_MS = 30_000;
const cliCommands = [CLI_NAME, DIST_NAME] as const;

export type CliCompatibilityState = {
  expectedVersion: string;
  installed: boolean;
  compatible: boolean;
  command: string | null;
  version: string | null;
  error: string | null;
};

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
  for (const command of cliCommands) {
    const result = spawnSync(command, ['--version'], {
      encoding: 'utf8',
      timeout: 2_000,
      windowsHide: true,
    });

    if (result.error) {
      continue;
    }

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const version = parseVersion(output);
    if (!version) {
      return {
        expectedVersion: VERSION,
        installed: true,
        compatible: false,
        command,
        version: null,
        error: 'CLI version could not be read',
      };
    }

    return {
      expectedVersion: VERSION,
      installed: true,
      compatible: version === VERSION,
      command,
      version,
      error: version === VERSION ? null : `CLI ${version} does not match extension ${VERSION}`,
    };
  }

  return {
    expectedVersion: VERSION,
    installed: false,
    compatible: false,
    command: null,
    version: null,
    error: 'CLI not found',
  };
}

function parseVersion(output: string): string | null {
  return output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/)?.[0] ?? null;
}
