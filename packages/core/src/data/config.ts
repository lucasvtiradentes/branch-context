import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, sep as pathSeparator, relative } from 'node:path';
import {
  BRANCHES_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_BASE_BRANCH,
  DEFAULT_TEMPLATE,
  TEMPLATES_DIR,
} from '../constants';
import { loadDefaultConfigResource } from '../resources';

let defaultConfig: ReturnType<typeof loadDefaultConfigResource> | null = null;

export type MachineConfig = {
  global_path?: string;
};

export class Config {
  defaultBaseBranch: string;
  sound: boolean;
  soundFile: string | null;
  commitDescription: boolean;

  constructor(options: Partial<Config> = {}) {
    const defaults = getDefaultConfig();
    this.defaultBaseBranch =
      options.defaultBaseBranch ?? defaults.default_base_branch ?? DEFAULT_BASE_BRANCH;
    this.sound = options.sound ?? defaults.sound ?? true;
    this.soundFile = options.soundFile ?? null;
    this.commitDescription = options.commitDescription ?? defaults.commit_description ?? false;
  }

  static load(workspace: string) {
    return new Config({
      ...readBehaviorConfig(getWorkspaceGlobalConfigPath(workspace)),
      ...readBehaviorConfig(getRepoConfigPath(workspace)),
    });
  }

  save(workspace: string) {
    const configPath = getRepoConfigPath(workspace);
    mkdirSync(dirname(configPath), { recursive: true });

    const data: Record<string, unknown> = {
      default_base_branch: this.defaultBaseBranch,
      sound: this.sound,
      commit_description: this.commitDescription,
    };

    if (this.soundFile) {
      data.sound_file = this.soundFile;
    }

    writeJson(configPath, data);
  }

  getTemplateForBranch(branch: string, templates: string[] = []) {
    const prefix = getBranchTemplatePrefix(branch);
    if (prefix && templates.includes(prefix)) {
      return prefix;
    }
    return DEFAULT_TEMPLATE;
  }
}

function getDefaultConfig() {
  defaultConfig ??= loadDefaultConfigResource();
  return defaultConfig;
}

export function getMachineConfigPath() {
  return join(homedir(), '.config', 'branch-context', 'config.json');
}

export function loadMachineConfig(): MachineConfig {
  const path = getMachineConfigPath();
  if (!existsSync(path)) {
    return {};
  }

  const data = readJsonObject(path);
  return typeof data.global_path === 'string' && data.global_path.trim()
    ? { global_path: data.global_path.trim() }
    : {};
}

export function saveMachineConfig(config: MachineConfig) {
  const path = getMachineConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeJson(path, config);
}

export function getConfiguredGlobalPath(override?: string | null) {
  const value = override?.trim() || loadMachineConfig().global_path || null;
  return value ? expandHome(value) : null;
}

export function getActiveGlobalPath(override?: string | null) {
  const globalPath = getConfiguredGlobalPath(override);
  return globalPath && isDirectory(globalPath) ? globalPath : null;
}

export function getDefaultTemplate() {
  return DEFAULT_TEMPLATE;
}

export function getConfigDir(workspace: string) {
  return join(workspace, CONFIG_DIR);
}

export function getRepoConfigPath(workspace: string) {
  return join(getConfigDir(workspace), CONFIG_FILE);
}

export function getGlobalConfigPath(globalPath = getActiveGlobalPath()) {
  return globalPath ? join(globalPath, CONFIG_FILE) : null;
}

export function getWorkspaceGlobalConfigPath(workspace: string) {
  const globalPath = getWorkspaceGlobalPath(workspace);
  return globalPath ? join(globalPath, CONFIG_FILE) : null;
}

export function getTemplatesDir(workspace: string) {
  const globalPath = getWorkspaceGlobalPath(workspace);
  return globalPath ? join(globalPath, TEMPLATES_DIR) : getLocalTemplatesDir(workspace);
}

export function getTemplateDir(workspace: string, template = getDefaultTemplate()) {
  return join(getTemplatesDir(workspace), template);
}

export function getBranchesDir(workspace: string) {
  return getLocalBranchesDir(workspace);
}

export function getLocalTemplatesDir(workspace: string) {
  return join(workspace, CONFIG_DIR, TEMPLATES_DIR);
}

export function getLocalBranchesDir(workspace: string) {
  return join(workspace, CONFIG_DIR, BRANCHES_DIR);
}

export function configExists(workspace: string) {
  return existsSync(getRepoConfigPath(workspace));
}

export function ensureConfig(workspace: string) {
  const configPath = getRepoConfigPath(workspace);
  if (!existsSync(configPath)) {
    new Config().save(workspace);
  }
}

export function copyInitConfig(workspace: string) {
  ensureConfig(workspace);
}

export function listTemplates(workspace: string) {
  const templatesDir = getTemplatesDir(workspace);
  if (!existsSync(templatesDir)) {
    return [];
  }

  return Array.from(new Set(readdirDirectoryNames(templatesDir)));
}

export function parseJson(content: string) {
  return JSON.parse(content) as Record<string, unknown>;
}

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function getWorkspaceGlobalPath(workspace: string) {
  try {
    const configDir = getConfigDir(workspace);
    if (!lstatSync(configDir).isSymbolicLink()) {
      return null;
    }

    const configDirTarget = realpathSync(configDir);
    const globalPath = getActiveGlobalPath();
    if (globalPath && isPathInside(configDirTarget, realpathSync(globalPath))) {
      return globalPath;
    }

    return inferGlobalPathFromConfigDirTarget(configDirTarget);
  } catch {
    return null;
  }
}

function inferGlobalPathFromConfigDirTarget(configDirTarget: string) {
  const marker = `${pathSeparator}branches${pathSeparator}repos${pathSeparator}`;
  const markerIndex = configDirTarget.indexOf(marker);
  return markerIndex === -1
    ? null
    : configDirTarget.slice(0, markerIndex + `${pathSeparator}branches`.length);
}

function isPathInside(path: string, parent: string) {
  const relativePath = relative(parent, path);
  return relativePath === '' || (!!relativePath && !relativePath.startsWith('..'));
}

function readBehaviorConfig(path: string | null): Partial<Config> {
  if (!path || !existsSync(path)) {
    return {};
  }

  try {
    const data = readJsonObject(path);
    return {
      defaultBaseBranch:
        typeof data.default_base_branch === 'string' ? data.default_base_branch : undefined,
      sound: typeof data.sound === 'boolean' ? data.sound : undefined,
      soundFile: typeof data.sound_file === 'string' ? data.sound_file : undefined,
      commitDescription:
        typeof data.commit_description === 'boolean' ? data.commit_description : undefined,
    };
  } catch {
    return {};
  }
}

function readJsonObject(path: string) {
  return parseJson(readFileSync(path, 'utf8'));
}

function writeJson(path: string, data: Record<string, unknown>) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function readdirDirectoryNames(dir: string) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function expandHome(path: string) {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

function getBranchTemplatePrefix(branch: string) {
  const [prefix] = branch.split('/');
  return prefix && prefix !== branch ? prefix : null;
}
