import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfig } from '../assets';
import {
  BRANCHES_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_TEMPLATE,
  TEMPLATES_DIR,
} from '../constants';

export type TemplateRule = {
  prefix: string;
  template: string;
};

export class Config {
  defaultBaseBranch: string;
  sound: boolean;
  soundFile: string | null;
  commitDescription: boolean;
  templateRules: TemplateRule[];

  constructor(options: Partial<Config> = {}) {
    this.defaultBaseBranch = options.defaultBaseBranch ?? defaultConfig.default_base_branch;
    this.sound = options.sound ?? defaultConfig.sound;
    this.soundFile = options.soundFile ?? null;
    this.commitDescription = options.commitDescription ?? defaultConfig.commit_description;
    this.templateRules =
      options.templateRules ??
      defaultConfig.template_rules.map((rule) => ({
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
      const data = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      const rawRules = Array.isArray(data.template_rules) ? data.template_rules : [];

      return new Config({
        defaultBaseBranch:
          typeof data.default_base_branch === 'string'
            ? data.default_base_branch
            : defaultConfig.default_base_branch,
        sound: typeof data.sound === 'boolean' ? data.sound : defaultConfig.sound,
        soundFile: typeof data.sound_file === 'string' ? data.sound_file : null,
        commitDescription:
          typeof data.commit_description === 'boolean'
            ? data.commit_description
            : defaultConfig.commit_description,
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
