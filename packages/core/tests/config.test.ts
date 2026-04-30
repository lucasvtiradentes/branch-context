import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRANCHES_DIR,
  CONFIG_DIR,
  Config,
  DEFAULT_TEMPLATE,
  getBranchesDir,
  getConfigDir,
  getTemplateDir,
  TEMPLATES_DIR,
} from '../src/index';
import { createTempDir } from './helpers';

describe('config', () => {
  it('gets config dir', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR));
    expect(getConfigDir(workspace)).toBe(join(workspace, CONFIG_DIR));
  });

  it('gets branches dir', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR));
    expect(getBranchesDir(workspace)).toBe(join(workspace, CONFIG_DIR, BRANCHES_DIR));
  });

  it('gets default template dir', () => {
    const workspace = createTempDir();
    expect(getTemplateDir(workspace)).toBe(
      join(workspace, CONFIG_DIR, TEMPLATES_DIR, DEFAULT_TEMPLATE),
    );
  });

  it('gets custom template dir', () => {
    const workspace = createTempDir();
    expect(getTemplateDir(workspace, 'feature')).toBe(
      join(workspace, CONFIG_DIR, TEMPLATES_DIR, 'feature'),
    );
  });

  it('returns false when config is missing', async () => {
    const { configExists } = await import('../src/index');
    expect(configExists(createTempDir())).toBe(false);
  });

  it('returns true when config exists', async () => {
    const { configExists } = await import('../src/index');
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    new Config().save(workspace);
    expect(configExists(workspace)).toBe(true);
  });

  it('uses default values', () => {
    expect(new Config().sound).toBe(true);
  });

  it('saves and loads config', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    new Config({ sound: true }).save(workspace);
    expect(Config.load(workspace).sound).toBe(true);
  });

  it('loads defaults when config file is missing', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    expect(Config.load(workspace).sound).toBe(true);
  });

  it('persists template rules', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    new Config({
      templateRules: [
        { prefix: 'feature/', template: 'feature' },
        { prefix: 'bugfix/', template: 'bugfix' },
      ],
    }).save(workspace);

    const loaded = Config.load(workspace);
    expect(loaded.templateRules).toHaveLength(2);
    expect(loaded.templateRules[0]).toEqual({ prefix: 'feature/', template: 'feature' });
  });

  it('selects template by branch prefix', () => {
    const config = new Config({
      templateRules: [
        { prefix: 'feature/', template: 'feature' },
        { prefix: 'bugfix/', template: 'bugfix' },
      ],
    });

    expect(config.getTemplateForBranch('feature/login')).toBe('feature');
    expect(config.getTemplateForBranch('bugfix/123')).toBe('bugfix');
    expect(config.getTemplateForBranch('main')).toBe(DEFAULT_TEMPLATE);
    expect(config.getTemplateForBranch('develop')).toBe(DEFAULT_TEMPLATE);
  });

  it('uses default commit description setting', () => {
    expect(new Config().commitDescription).toBe(false);
  });

  it('saves and loads commit description setting', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    new Config({ commitDescription: true }).save(workspace);
    expect(Config.load(workspace).commitDescription).toBe(true);
  });

  it('loads missing commit description as backward compatible default', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    writeFileSync(
      join(workspace, CONFIG_DIR, 'config.json'),
      JSON.stringify({ sound: true, template_rules: [] }),
    );
    expect(existsSync(join(workspace, CONFIG_DIR, 'config.json'))).toBe(true);
    expect(Config.load(workspace).commitDescription).toBe(false);
  });
});
