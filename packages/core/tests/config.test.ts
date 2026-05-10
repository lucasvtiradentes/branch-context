import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRANCHES_DIR,
  BranchContextConfigSchema,
  CONFIG_DIR,
  CONFIG_FILE,
  Config,
  copyInitConfig,
  createBranchContextConfigJsonSchema,
  DEFAULT_TEMPLATE,
  getBranchesDir,
  getConfigDir,
  getResourcesDir,
  getTemplateDir,
  getTemplatesDir,
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

  it('gets external branches dir from config', () => {
    const workspace = createTempDir();
    const externalPath = join(createTempDir(), BRANCHES_DIR);
    new Config({
      branchesFolder: externalPath,
    }).save(workspace);
    expect(getBranchesDir(workspace)).toBe(externalPath);
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

  it('gets external template dir from config', () => {
    const workspace = createTempDir();
    const templatesPath = join(createTempDir(), TEMPLATES_DIR);
    new Config({
      templatesFolder: templatesPath,
    }).save(workspace);
    expect(getTemplatesDir(workspace)).toBe(templatesPath);
    expect(getTemplateDir(workspace, 'feature')).toBe(join(templatesPath, 'feature'));
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

  it('copies init config from resources', () => {
    const workspace = createTempDir();
    copyInitConfig(workspace);
    const loaded = Config.load(workspace);
    expect(loaded.defaultBaseBranch).toBe('origin/main');
    expect(loaded.branchesFolder).toBe(`${CONFIG_DIR}/${BRANCHES_DIR}`);
    expect(loaded.templatesFolder).toBe(`${CONFIG_DIR}/${TEMPLATES_DIR}`);
  });

  it('finds resources when cwd is outside the package', () => {
    const workspace = createTempDir();
    process.chdir(workspace);
    expect(existsSync(join(getResourcesDir(), CONFIG_FILE))).toBe(true);
  });

  it('loads defaults when config file is missing', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    expect(Config.load(workspace).sound).toBe(true);
  });

  it('persists branch and template folders', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    const branchesFolder = join(createTempDir(), BRANCHES_DIR);
    const templatesFolder = join(createTempDir(), TEMPLATES_DIR);
    new Config({
      branchesFolder,
      templatesFolder,
    }).save(workspace);

    const loaded = Config.load(workspace);
    expect(loaded.branchesFolder).toBe(branchesFolder);
    expect(loaded.templatesFolder).toBe(templatesFolder);
  });

  it('selects template by branch prefix when the template exists', () => {
    const config = new Config();

    expect(config.getTemplateForBranch('feature/login', ['feature'])).toBe('feature');
    expect(config.getTemplateForBranch('bugfix/123', ['feature', 'fix'])).toBe(DEFAULT_TEMPLATE);
    expect(config.getTemplateForBranch('main', ['main'])).toBe(DEFAULT_TEMPLATE);
    expect(config.getTemplateForBranch('develop', ['develop'])).toBe(DEFAULT_TEMPLATE);
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

  it('loads old storage and templates settings as folder paths', () => {
    const workspace = createTempDir();
    const externalPath = join(createTempDir(), 'project');
    const templatesPath = join(createTempDir(), TEMPLATES_DIR);
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    writeFileSync(
      join(workspace, CONFIG_DIR, CONFIG_FILE),
      JSON.stringify({
        storage: { mode: 'external', external_path: externalPath },
        templates: { mode: 'external', path: templatesPath },
      }),
    );

    const loaded = Config.load(workspace);
    expect(loaded.branchesFolder).toBe(join(externalPath, BRANCHES_DIR));
    expect(loaded.templatesFolder).toBe(templatesPath);
  });

  it('falls back to default folders when custom folder paths are invalid', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    writeFileSync(
      join(workspace, CONFIG_DIR, CONFIG_FILE),
      JSON.stringify({
        branches_folder: '',
        templates_folder: '',
      }),
    );

    const loaded = Config.load(workspace);
    expect(loaded.branchesFolder).toBe(`${CONFIG_DIR}/${BRANCHES_DIR}`);
    expect(loaded.templatesFolder).toBe(`${CONFIG_DIR}/${TEMPLATES_DIR}`);
  });

  it('loads missing commit description as backward compatible default', () => {
    const workspace = createTempDir();
    mkdirSync(join(workspace, CONFIG_DIR), { recursive: true });
    writeFileSync(
      join(workspace, CONFIG_DIR, CONFIG_FILE),
      JSON.stringify({ sound: true, template_rules: [] }),
    );
    expect(existsSync(join(workspace, CONFIG_DIR, CONFIG_FILE))).toBe(true);
    expect(Config.load(workspace).commitDescription).toBe(false);
  });

  it('validates config schema shape', () => {
    const result = BranchContextConfigSchema.safeParse({
      default_base_branch: 'main',
      sound: false,
      commit_description: true,
      branches_folder: '/tmp/bctx-contexts/project/branches',
      templates_folder: '/tmp/bctx-templates',
    });
    expect(result.success).toBe(true);
  });

  it('generates JSON schema for config files', () => {
    const schema = createBranchContextConfigJsonSchema();
    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        default_base_branch: { type: 'string' },
        branches_folder: { type: 'string' },
        templates_folder: { type: 'string' },
      },
    });
  });
});
