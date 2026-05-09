import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import {
  BRANCHES_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_BASE_BRANCH,
  DEFAULT_TEMPLATE,
  TEMPLATES_DIR,
} from '../constants';
import { copyInitConfigResource, loadDefaultConfigResource } from '../resources';

let defaultConfig: ReturnType<typeof loadDefaultConfigResource> | null = null;

export class Config {
  defaultBaseBranch: string;
  sound: boolean;
  soundFile: string | null;
  commitDescription: boolean;
  branchesFolder: string;
  templatesFolder: string;

  constructor(options: Partial<Config> = {}) {
    const defaults = getDefaultConfig();
    this.defaultBaseBranch =
      options.defaultBaseBranch ?? defaults.default_base_branch ?? DEFAULT_BASE_BRANCH;
    this.sound = options.sound ?? defaults.sound ?? true;
    this.soundFile = options.soundFile ?? null;
    this.commitDescription = options.commitDescription ?? defaults.commit_description ?? false;
    this.branchesFolder = options.branchesFolder ?? defaults.branches_folder ?? '.';
    this.templatesFolder = options.templatesFolder ?? defaults.templates_folder ?? '.';
  }

  static load(workspace: string) {
    const configPath = join(workspace, CONFIG_DIR, CONFIG_FILE);
    if (!existsSync(configPath)) {
      return new Config();
    }

    try {
      const defaults = getDefaultConfig();
      const data = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

      return new Config({
        defaultBaseBranch:
          typeof data.default_base_branch === 'string'
            ? data.default_base_branch
            : (defaults.default_base_branch ?? DEFAULT_BASE_BRANCH),
        sound: typeof data.sound === 'boolean' ? data.sound : (defaults.sound ?? true),
        soundFile: typeof data.sound_file === 'string' ? data.sound_file : null,
        commitDescription:
          typeof data.commit_description === 'boolean'
            ? data.commit_description
            : (defaults.commit_description ?? false),
        branchesFolder: parseBranchesFolder(data),
        templatesFolder: parseTemplatesFolder(data),
      });
    } catch {
      return new Config();
    }
  }

  save(workspace: string) {
    const configPath = join(workspace, CONFIG_DIR, CONFIG_FILE);
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });

    const data: Record<string, unknown> = {
      default_base_branch: this.defaultBaseBranch,
      sound: this.sound,
      commit_description: this.commitDescription,
      branches_folder: this.branchesFolder,
      templates_folder: this.templatesFolder,
    };

    if (this.soundFile) {
      data.sound_file = this.soundFile;
    }

    writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`);
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

export function getDefaultTemplate() {
  return DEFAULT_TEMPLATE;
}

export function getConfigDir(workspace: string) {
  return join(workspace, CONFIG_DIR);
}

export function getTemplatesDir(workspace: string) {
  const config = Config.load(workspace);
  return resolveConfiguredFolder(workspace, config.templatesFolder, TEMPLATES_DIR);
}

export function getTemplateDir(workspace: string, template = getDefaultTemplate()) {
  return join(getTemplatesDir(workspace), template);
}

export function getBranchesDir(workspace: string) {
  const config = Config.load(workspace);
  return resolveConfiguredFolder(workspace, config.branchesFolder, BRANCHES_DIR);
}

export function getLocalTemplatesDir(workspace: string) {
  return join(workspace, CONFIG_DIR, TEMPLATES_DIR);
}

export function getLocalBranchesDir(workspace: string) {
  return join(workspace, CONFIG_DIR, BRANCHES_DIR);
}

export function configExists(workspace: string) {
  return existsSync(join(workspace, CONFIG_DIR, CONFIG_FILE));
}

export function copyInitConfig(workspace: string) {
  copyInitConfigResource(workspace);
}

export function listTemplates(workspace: string) {
  const templatesDir = getTemplatesDir(workspace);
  if (!existsSync(templatesDir)) {
    return [];
  }

  return Array.from(new Set(readdirDirectoryNames(templatesDir)));
}

function readdirDirectoryNames(dir: string) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function resolveConfiguredFolder(workspace: string, value: string, localFolderName: string) {
  if (value === '.') {
    return join(workspace, CONFIG_DIR, localFolderName);
  }

  return isAbsolute(value) ? value : resolve(workspace, value);
}

function parseBranchesFolder(data: Record<string, unknown>) {
  if (typeof data.branches_folder === 'string' && data.branches_folder.trim()) {
    return data.branches_folder;
  }

  if (isObject(data.storage) && typeof data.storage.external_path === 'string') {
    return join(data.storage.external_path, BRANCHES_DIR);
  }

  return getDefaultConfig().branches_folder ?? '.';
}

function parseTemplatesFolder(data: Record<string, unknown>) {
  if (typeof data.templates_folder === 'string' && data.templates_folder.trim()) {
    return data.templates_folder;
  }

  if (isObject(data.templates) && typeof data.templates.path === 'string') {
    return data.templates.path;
  }

  return getDefaultConfig().templates_folder ?? '.';
}

function getBranchTemplatePrefix(branch: string) {
  const [prefix] = branch.split('/');
  return prefix && prefix !== branch ? prefix : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
