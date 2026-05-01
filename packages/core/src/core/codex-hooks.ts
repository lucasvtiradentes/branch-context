import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { getBranchctxPath } from './hooks';

export const CODEX_HOOK_EVENT = 'SessionStart';
export const CODEX_HOOK_MATCHER = 'startup|resume';
export const CODEX_HOOK_STATUS = 'branch-context: capture session metadata';

type CodexHooksConfig = {
  hooks: Record<string, CodexHookGroup[]>;
} & Record<string, unknown>;

type CodexHookGroup = {
  matcher?: string;
  hooks?: CodexHook[];
};

type CodexHook = {
  type?: string;
  command?: string;
  statusMessage?: string;
};

export type CodexHookOptions = {
  hooksPath?: string;
  configPath?: string;
  command?: string;
};

export type CodexHookStatus = {
  installed: boolean;
  hooksPath: string;
  configPath: string;
};

export function getCodexHooksPath(homeDir = homedir()) {
  return join(homeDir, '.codex', 'hooks.json');
}

export function getCodexConfigPath(homeDir = homedir()) {
  return join(homeDir, '.codex', 'config.toml');
}

export function getCodexMetadataHookCommand() {
  return `"${getBranchctxPath()}" agents codex-hook`;
}

export function getCodexHookStatus(options: CodexHookOptions = {}): CodexHookStatus {
  const hooksPath = options.hooksPath ?? getCodexHooksPath();
  const configPath = options.configPath ?? getCodexConfigPath();
  const config = readHooksConfig(hooksPath);

  return {
    installed: hasCodexMetadataHook(config),
    hooksPath,
    configPath,
  };
}

export function installCodexMetadataHook(options: CodexHookOptions = {}): CodexHookStatus {
  const hooksPath = options.hooksPath ?? getCodexHooksPath();
  const configPath = options.configPath ?? getCodexConfigPath();
  const command = options.command ?? getCodexMetadataHookCommand();
  const config = removeCodexMetadataHooks(readHooksConfig(hooksPath));
  const sessionStart = config.hooks[CODEX_HOOK_EVENT] ?? [];

  sessionStart.push({
    matcher: CODEX_HOOK_MATCHER,
    hooks: [
      {
        type: 'command',
        command,
        statusMessage: CODEX_HOOK_STATUS,
      },
    ],
  });
  config.hooks[CODEX_HOOK_EVENT] = sessionStart;
  writeJsonFile(hooksPath, config);

  upsertTomlBool(configPath, 'features', 'codex_hooks', true);
  return getCodexHookStatus({ hooksPath, configPath });
}

export function uninstallCodexMetadataHook(options: CodexHookOptions = {}): CodexHookStatus {
  const hooksPath = options.hooksPath ?? getCodexHooksPath();
  const configPath = options.configPath ?? getCodexConfigPath();
  const config = removeCodexMetadataHooks(readHooksConfig(hooksPath));

  writeJsonFile(hooksPath, config);
  return getCodexHookStatus({ hooksPath, configPath });
}

export function upsertTomlBool(path: string, section: string, key: string, value: boolean): void {
  const boolValue = value ? 'true' : 'false';
  if (!existsSync(path)) {
    writeTextFile(path, `[${section}]\n${key} = ${boolValue}\n`);
    return;
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const output: string[] = [];
  let inSection = false;
  let seenSection = false;
  let inserted = false;

  for (const line of lines) {
    if (line === `[${section}]`) {
      seenSection = true;
      inSection = true;
      output.push(line);
      continue;
    }

    if (/^\[.+\]$/.test(line)) {
      if (inSection && !inserted) {
        output.push(`${key} = ${boolValue}`);
        inserted = true;
      }
      inSection = false;
      output.push(line);
      continue;
    }

    if (inSection && new RegExp(`^${escapeRegex(key)}\\s*=`).test(line)) {
      if (!inserted) {
        output.push(`${key} = ${boolValue}`);
        inserted = true;
      }
      continue;
    }

    output.push(line);
  }

  if (!seenSection) {
    if (output.length > 0 && output.at(-1) !== '') {
      output.push('');
    }
    output.push(`[${section}]`, `${key} = ${boolValue}`);
  } else if (inSection && !inserted) {
    output.push(`${key} = ${boolValue}`);
  }

  writeTextFile(path, `${output.join('\n').replace(/\n+$/, '')}\n`);
}

function readHooksConfig(path: string): CodexHooksConfig {
  if (!existsSync(path)) {
    return { hooks: {} };
  }

  try {
    return normalizeHooksConfig(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return { hooks: {} };
  }
}

function normalizeHooksConfig(value: unknown): CodexHooksConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { hooks: {} };
  }

  const config = { ...(value as Record<string, unknown>), hooks: {} } as CodexHooksConfig;
  const hooks = (value as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return config;
  }

  for (const [event, groups] of Object.entries(hooks)) {
    config.hooks[event] = Array.isArray(groups)
      ? groups.filter((group): group is CodexHookGroup =>
          Boolean(group && typeof group === 'object'),
        )
      : [];
  }

  return config;
}

function hasCodexMetadataHook(config: CodexHooksConfig) {
  return Object.values(config.hooks).some((groups) =>
    groups.some((group) => (group.hooks ?? []).some(isCodexMetadataHook)),
  );
}

function removeCodexMetadataHooks(config: CodexHooksConfig): CodexHooksConfig {
  for (const [event, groups] of Object.entries(config.hooks)) {
    const nextGroups = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook) => !isCodexMetadataHook(hook)),
      }))
      .filter((group) => (group.hooks ?? []).length > 0);

    if (nextGroups.length > 0) {
      config.hooks[event] = nextGroups;
    } else {
      delete config.hooks[event];
    }
  }

  return config;
}

function isCodexMetadataHook(hook: CodexHook) {
  return (
    hook.statusMessage === CODEX_HOOK_STATUS ||
    (typeof hook.command === 'string' && hook.command.includes('agents codex-hook'))
  );
}

function writeJsonFile(path: string, data: unknown) {
  writeTextFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

function writeTextFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
