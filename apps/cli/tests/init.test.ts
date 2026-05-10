import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addToGitignore,
  Config,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  gitAdd,
  gitCheckout,
  gitCommit,
} from '@branch-context/core';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/index';
import { captureConsole, createGitRepo, createTempDir, expectOk, git } from './helpers';

describe('init command', () => {
  it('creates gitignore file when adding entry', () => {
    const dir = createTempDir();
    addToGitignore(dir, '_context');
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('_context\n');
  });

  it('appends gitignore entry', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n');
    addToGitignore(dir, '_context');
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('node_modules/\n.env\n_context\n');
  });

  it('does not duplicate gitignore entry', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, '.gitignore'), '_context\n');
    addToGitignore(dir, '_context');
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('_context\n');
  });

  it('handles gitignore without trailing newline', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, '.gitignore'), 'node_modules/');
    addToGitignore(dir, '_context');
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('node_modules/\n_context\n');
  });

  it('init creates symlink', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await runCli(['init']);
    expect(existsSync(join(repo, DEFAULT_SYMLINK))).toBe(true);
  });

  it('init gitignores local machine state but leaves templates trackable', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await runCli(['init']);
    const gitignore = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(gitignore).toContain(`${DEFAULT_SYMLINK}\n`);
    expect(gitignore).toContain('.bctx/*\n');
    expect(gitignore).toContain('!.bctx/templates/\n');
    expect(gitignore).toContain('!.bctx/templates/**\n');
    expect(gitignore).not.toContain('.bctx/config.json');
    expect(gitignore).not.toContain('.bctx/branches/');
  });

  it('init gitignores custom branch folders inside the repo', async () => {
    const repo = createGitRepo();
    const branchesParentFolder = join(repo, 'repo-contexts');
    mkdirSync(branchesParentFolder);
    process.chdir(repo);

    await runCli(['init', '--branches-parent-folder', branchesParentFolder]);

    const gitignore = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(gitignore).toContain('repo-contexts/branches/\n');
    expect(gitignore).not.toContain('.bctx/branches/');
  });

  it('init does not gitignore custom branch folders outside the repo', async () => {
    const repo = createGitRepo();
    const branchesParentFolder = createTempDir();
    process.chdir(repo);

    await runCli(['init', '--branches-parent-folder', branchesParentFolder]);

    const gitignore = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(gitignore).not.toContain(`${branchesParentFolder}/`);
    expect(gitignore).not.toContain('.bctx/branches/');
  });

  it('init keeps custom templates folders inside .bctx trackable', async () => {
    const repo = createGitRepo();
    const templatesFolder = join(repo, '.bctx', 'team-templates');
    mkdirSync(templatesFolder, { recursive: true });
    process.chdir(repo);

    await runCli(['init', '--templates-folder', templatesFolder]);

    const gitignore = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.bctx/*\n');
    expect(gitignore).toContain('!.bctx/team-templates/\n');
    expect(gitignore).toContain('!.bctx/team-templates/**\n');
  });

  it('init keeps local templates trackable when configured templates are external', async () => {
    const repo = createGitRepo();
    const templatesFolder = createTempDir();
    process.chdir(repo);

    await runCli(['init', '--templates-folder', templatesFolder]);

    const gitignore = readFileSync(join(repo, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.bctx/*\n');
    expect(gitignore).toContain('!.bctx/templates/\n');
    expect(gitignore).toContain('!.bctx/templates/**\n');
  });

  it('init syncs current branch through core service', async () => {
    const repo = createGitRepo();
    expectOk(git(['branch', 'origin/main', 'main'], repo));
    expectOk(gitCheckout(repo, 'feature/init-sync', true));
    writeFileSync(join(repo, 'feature.txt'), 'changed');
    expectOk(gitAdd(repo));
    expectOk(gitCommit(repo, 'feat: init sync'));

    process.chdir(repo);
    await runCli(['init']);

    const content = readFileSync(join(repo, DEFAULT_SYMLINK, 'context.md'), 'utf8');
    expect(content).toContain('feat: init sync');
    expect(content).toContain('feature.txt');
  });

  it('init fails when symlink path is blocked', async () => {
    const repo = createGitRepo();
    expectOk(git(['branch', 'origin/main', 'main'], repo));
    writeFileSync(join(repo, DEFAULT_SYMLINK), 'blocked');
    process.chdir(repo);
    const capture = captureConsole();

    const result = await runCli(['init']);

    expect(result).toBe(1);
    expect(capture.output).toContain(`error: ${DEFAULT_SYMLINK} exists but is not a symlink`);
  });

  it('init warns when current branch base is missing', async () => {
    const repo = createGitRepo();
    expectOk(git(['branch', '-m', 'master'], repo));
    process.chdir(repo);
    const capture = captureConsole();

    const result = await runCli(['init']);

    expect(result).toBe(0);
    expect(capture.output).toContain('warning: base branch not found: origin/main');
  });

  it('init can store branch contexts in a custom folder', async () => {
    const repo = createGitRepo();
    const branchesParentFolder = createTempDir();
    const branchesFolder = join(branchesParentFolder, 'branches');
    process.chdir(repo);

    const result = await runCli(['init', '--branches-parent-folder', branchesParentFolder]);

    expect(result).toBe(0);
    const config = Config.load(repo);
    expect(config.branchesFolder).toBe(branchesFolder);
    expect(existsSync(join(branchesFolder, 'main', 'context.md'))).toBe(true);
    expect(existsSync(join(repo, DEFAULT_SYMLINK, 'context.md'))).toBe(true);
  });

  it('init rejects missing custom branch folders', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    const capture = captureConsole();

    const result = await runCli(['init', '--branches-parent-folder', join(repo, 'contexts')]);

    expect(result).toBe(1);
    expect(capture.output).toContain('error: branches parent folder does not exist');
  });

  it('init can use a custom templates folder', async () => {
    const repo = createGitRepo();
    const templatesPath = createTempDir();
    process.chdir(repo);

    const result = await runCli(['init', '--templates-folder', templatesPath]);

    expect(result).toBe(0);
    const config = Config.load(repo);
    expect(config.templatesFolder).toBe(templatesPath);
    expect(existsSync(join(templatesPath, DEFAULT_TEMPLATE, 'context.md'))).toBe(true);
  });

  it('template source updates the templates folder', async () => {
    const repo = createGitRepo();
    const templatesPath = createTempDir();
    process.chdir(repo);
    await runCli(['init']);

    const result = await runCli(['template', 'source', templatesPath]);

    expect(result).toBe(0);
    expect(Config.load(repo).templatesFolder).toBe(templatesPath);
  });
});
