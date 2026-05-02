import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRANCHES_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_BASE_BRANCH,
  DEFAULT_TEMPLATE,
  TEMPLATES_DIR,
} from '../constants';
import { copyInitConfigResource, loadDefaultConfigResource } from '../resources';

export type TemplateRule = {
  prefix: string;
  template: string;
};

let defaultConfig: ReturnType<typeof loadDefaultConfigResource> | null = null;

export class Config {
  defaultBaseBranch: string;
  sound: boolean;
  soundFile: string | null;
  commitDescription: boolean;
  templateRules: TemplateRule[];

  constructor(options: Partial<Config> = {}) {
    const defaults = getDefaultConfig();
    this.defaultBaseBranch =
      options.defaultBaseBranch ?? defaults.default_base_branch ?? DEFAULT_BASE_BRANCH;
    this.sound = options.sound ?? defaults.sound ?? true;
    this.soundFile = options.soundFile ?? null;
    this.commitDescription = options.commitDescription ?? defaults.commit_description ?? false;
    this.templateRules =
      options.templateRules ??
      (defaults.template_rules ?? []).map((rule) => ({
        prefix: rule.prefix,
        template: rule.template,
      }));
  }

  static load(workspace: string) {
    const configPath = join(workspace, CONFIG_DIR, CONFIG_FILE);
    if (!existsSync(configPath)) {
      return new Config();
    }

    try {
      const defaults = getDefaultConfig();
      const data = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      const rawRules = Array.isArray(data.template_rules) ? data.template_rules : [];

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
        templateRules: rawRules
          .filter(
            (rule): rule is Record<string, unknown> => typeof rule === 'object' && rule !== null,
          )
          .map((rule) => ({
            prefix: String(rule.prefix ?? ''),
            template: String(rule.template ?? ''),
          })),
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
      template_rules: this.templateRules.map((rule) => ({
        prefix: rule.prefix,
        template: rule.template,
      })),
    };

    if (this.soundFile) {
      data.sound_file = this.soundFile;
    }

    writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`);
  }

  getTemplateForBranch(branch: string) {
    for (const rule of this.templateRules) {
      if (branch.startsWith(rule.prefix)) {
        return rule.template;
      }
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
  return join(workspace, CONFIG_DIR, TEMPLATES_DIR);
}

export function getTemplateDir(workspace: string, template = getDefaultTemplate()) {
  return join(workspace, CONFIG_DIR, TEMPLATES_DIR, template);
}

export function getBranchesDir(workspace: string) {
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
