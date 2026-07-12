import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addToGitignore,
  CONFIG_DIR,
  CONTEXT_FILE_NAME,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  gitAdd,
  gitCheckout,
  gitCommit,
} from '@branch-context/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../dist/cli.js';
import { captureConsole, createGitRepo, createTempDir, expectOk, git } from './helpers';

const PROGRAM_NAME_ENV = 'BRANCH_CONTEXT_PROG_NAME';
const originalProgramName = process.env[PROGRAM_NAME_ENV];

beforeAll(() => {
  process.env[PROGRAM_NAME_ENV] = 'node';
});

afterAll(() => {
  if (originalProgramName === undefined) {
    delete process.env[PROGRAM_NAME_ENV];
    return;
  }
  process.env[PROGRAM_NAME_ENV] = originalProgramName;
});

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

  it('init skips folder prompts when already initialized', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await runCli(['init']);
    const capture = captureConsole();
    const previousIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });

    try {
      const result = await runCli(['init']);

      expect(result).toBe(0);
      expect(capture.output).not.toContain('Branches parent folder');
      expect(capture.output).not.toContain('Templates folder');
      expect(capture.output).toContain('Already initialized');
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        configurable: true,
        value: previousIsTty,
      });
    }
  });

  it('init excludes local machine state without changing gitignore', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await runCli(['init']);
    const exclude = readFileSync(join(repo, '.git', 'info', 'exclude'), 'utf8');
    expect(exclude).toContain(`${DEFAULT_SYMLINK}\n`);
    expect(exclude).toContain(`${CONFIG_DIR}\n`);
    expect(existsSync(join(repo, '.gitignore'))).toBe(false);
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

    const content = readFileSync(join(repo, DEFAULT_SYMLINK, CONTEXT_FILE_NAME), 'utf8');
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

  it('template applies by name', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await runCli(['init']);
    await runCli(['base', 'main']);
    const capture = captureConsole();

    const result = await runCli(['template', DEFAULT_TEMPLATE]);

    expect(result).toBe(0);
    expect(capture.output).toContain(`Applied template '${DEFAULT_TEMPLATE}' to 'main'`);
  });
});
