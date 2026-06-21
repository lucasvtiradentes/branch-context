import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyTemplateToCurrentBranch,
  BranchContextActionErrorReason,
  CONTEXT_FILE_NAME,
  getBranchDir,
  gitCheckout,
  syncCurrentBranch,
} from '../src/index';
import { createGitRepo, initBctxWorkspace } from './helpers';

describe('template variables', () => {
  it('renders branch variables into templates', () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    gitCheckout(repo, 'feature/test', true);
    syncCurrentBranch(repo, { sound: false });

    const contextPath = join(getBranchDir(repo, 'feature/test'), CONTEXT_FILE_NAME);
    const content = readFileSync(contextPath, 'utf8');

    expect(content).toContain('branch: feature/test');
    expect(content).toContain('author: ');
  });

  it('applies template to current branch through service', () => {
    const repo = createGitRepo();
    expect(gitCheckout(repo, 'origin/main', true).status).toBe(0);
    expect(gitCheckout(repo, 'main').status).toBe(0);
    initBctxWorkspace(repo);
    syncCurrentBranch(repo, { sound: false });
    const contextPath = join(getBranchDir(repo, 'main'), CONTEXT_FILE_NAME);
    writeFileSync(contextPath, 'MODIFIED CONTENT');
    const result = applyTemplateToCurrentBranch(repo, 'fix');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.branch).toBe('main');
    expect(result.template).toBe('fix');
    const content = readFileSync(contextPath, 'utf8');
    expect(content).toContain('## Fix');
    expect(content).not.toContain('MODIFIED CONTENT');
  });

  it('reports missing config through template service', () => {
    const repo = createGitRepo();
    const result = applyTemplateToCurrentBranch(repo, 'fix');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe(BranchContextActionErrorReason.NotInitialized);
  });
});
