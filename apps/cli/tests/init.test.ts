import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '@branch-context/core/constants';
import { describe, expect, it } from 'vitest';
import { addToGitignore, cmdInit } from '../src/index';
import { createGitRepo, createTempDir } from './helpers';

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
    await cmdInit([]);
    expect(existsSync(join(repo, DEFAULT_SYMLINK))).toBe(true);
  });

  it('init adds symlink to gitignore', async () => {
    const repo = createGitRepo();
    process.chdir(repo);
    await cmdInit([]);
    expect(readFileSync(join(repo, '.gitignore'), 'utf8')).toContain(DEFAULT_SYMLINK);
  });
});
