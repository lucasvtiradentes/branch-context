import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { setMultiSelectOverride } from '../src/cli/prompt';
import { gitAdd, gitCommit, gitConfig, gitInit } from '../src/git';
import { Config, copyInitTemplates, getBranchesDir, getTemplateDir } from '../src/index';

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
  return {
    branchesDir: getBranchesDir(repo),
    templateDir: getTemplateDir(repo),
  };
}

export function createWorkspace() {
  const workspace = createTempDir();
  mkdirSync(join(workspace, '.git', 'hooks'), { recursive: true });
  initBctxWorkspace(workspace);
  return workspace;
}

export function createWorkspaceNoTemplate() {
  const workspace = createTempDir();
  mkdirSync(join(workspace, '.git'), { recursive: true });
  mkdirSync(join(workspace, '.bctx', 'branches'), { recursive: true });
  new Config({ sound: false }).save(workspace);
  return workspace;
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
