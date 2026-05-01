import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Config,
  copyInitTemplates,
  gitAdd,
  gitCommit,
  gitConfig,
  gitInit,
  setMultiSelectOverride,
} from '@branch-context/core';
import { afterEach, beforeEach, expect, vi } from 'vitest';

const repos: string[] = [];
let originalCwd = process.cwd();

export function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'bctx-'));
  repos.push(dir);
  return dir;
}

export function expectOk(result: { status: number | null; stderr?: string }) {
  expect(result.status).toBe(0);
}

export function createGitRepo() {
  const repo = createTempDir();
  expectOk(gitInit(repo, 'main'));
  expectOk(gitConfig(repo, 'user.email', 'test@test.com'));
  expectOk(gitConfig(repo, 'user.name', 'Test User'));
  writeFileSync(join(repo, 'README.md'), '# Test');
  expectOk(gitAdd(repo));
  expectOk(gitCommit(repo, 'init'));
  return repo;
}

export function initBctxWorkspace(repo: string, sound = false) {
  mkdirSync(join(repo, '.bctx', 'branches'), { recursive: true });
  copyInitTemplates(join(repo, '.bctx', 'templates'));
  new Config({ sound }).save(repo);
}

export function captureConsole() {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  return {
    spy,
    get output() {
      return lines.join('\n');
    },
  };
}

export function git(args: string[], cwd: string) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

beforeEach(() => {
  originalCwd = process.cwd();
});

afterEach(() => {
  vi.restoreAllMocks();
  setMultiSelectOverride(null);
  process.chdir(originalCwd);
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo) {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});
