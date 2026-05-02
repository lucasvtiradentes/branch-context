import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Config,
  createBranchContext,
  getBranchDir,
  getStatus,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  installHook,
  syncBranch,
} from '@branch-context/core';
import { describe, expect, it } from 'vitest';
import { cmdStatus } from '../src/commands/status';
import { captureConsole, createGitRepo, initBctxWorkspace } from './helpers';

describe('status command', () => {
  it('errors when not initialized', () => {
    const repo = createGitRepo();
    process.chdir(repo);
    const capture = captureConsole();
    expect(cmdStatus([])).toBe(1);
    expect(capture.output).toContain('not initialized');
  });

  it('returns uninitialized status data', () => {
    const repo = createGitRepo();
    const status = getStatus(repo);
    expect(status.initialized).toBe(false);
    expect(status.gitRoot).toBe(repo);
    expect(status.issues.some((issue) => issue.message === 'not initialized')).toBe(true);
  });

  it('shows branch and base', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('Branch:');
    expect(capture.output).toContain('Base:');
  });

  it('returns initialized status data', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    const status = getStatus(repo);
    expect(status.initialized).toBe(true);
    expect(status.currentBranch).toBe('main');
    expect(status.currentContextDir).toContain('.bctx/branches/main');
    expect(status.currentContextRelPath).toBe('.bctx/branches/main');
    expect(status.templates).toContain('_default');
    expect(status.symlink.state).toBe('valid');
  });

  it('detects manually applied template from context content', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    new Config({ sound: false, templateRules: [{ prefix: 'fix/', template: 'fix' }] }).save(repo);

    const batchTemplateDir = join(repo, '.bctx', 'templates', 'batch');
    mkdirSync(batchTemplateDir);
    writeFileSync(
      join(batchTemplateDir, 'context.md'),
      `---
branch: {{branch}}
created: {{date}}
author: {{author}}
---

<!--
  This is a BATCH branch - multiple Linear tickets handled in one branch.
-->

## Goal

-

## Tickets

-
`,
    );

    createBranchContext(repo, 'feature/fb_partner_reports_and_payouts', 'batch');
    const status = getStatus(repo);
    const context = status.recentContexts.find(
      (item) => item.branchKey === 'feature-fb_partner_reports_and_payouts',
    );

    expect(context?.template).toBe('batch');
    expect(context?.contextDir).toBe(getBranchDir(repo, 'feature/fb_partner_reports_and_payouts'));
  });

  it('shows current branch', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('main');
  });

  it('shows health hooks', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('hook');
  });

  it('shows installed checkout hook', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    await installHook(repo, HOOK_POST_CHECKOUT);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('post-checkout');
  });

  it('shows templates', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('Templates:');
    expect(capture.output).toContain('_default');
  });

  it('shows contexts count', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('1 contexts');
  });

  it('shows health section', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    await installHook(repo, HOOK_POST_CHECKOUT);
    await installHook(repo, HOOK_POST_COMMIT);
    syncBranch(repo, 'main');
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('Health:');
    expect(capture.output).toContain('[ok]');
  });

  it('shows symlink not set', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('symlink not set');
  });

  it('shows symlink valid', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    process.chdir(repo);
    const capture = captureConsole();
    cmdStatus([]);
    expect(capture.output).toContain('symlink valid');
  });

  it('reports missing configured base ref', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    new Config({ defaultBaseBranch: 'origin/main', sound: false }).save(repo);
    syncBranch(repo, 'main');
    const status = getStatus(repo);
    expect(status.issues).toContainEqual({
      level: 'error',
      message: 'base branch not found: origin/main',
    });
  });

  it('returns error when hook missing', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    syncBranch(repo, 'main');
    rmSync(`${repo}/.git/hooks/post-checkout`, { force: true });
    process.chdir(repo);
    const capture = captureConsole();
    expect(cmdStatus([])).toBe(1);
    expect(capture.output).toContain('[!!]');
    expect(capture.output).toContain('post-checkout');
  });
});
