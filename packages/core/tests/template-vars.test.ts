import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitCheckout } from '../src/git';
import {
  applyTemplateToCurrentBranch,
  BranchContextActionErrorReason,
  getBranchDir,
  getTemplateVariables,
  renderTemplateContent,
  syncCurrentBranch,
} from '../src/index';
import { createGitRepo, initBctxWorkspace } from './helpers';

describe('template variables', () => {
  it('includes branch', () => {
    expect(getTemplateVariables('feature/login').branch).toBe('feature/login');
  });

  it('includes date', () => {
    const date = getTemplateVariables('main').date;
    expect(date).toHaveLength(10);
    expect(date).toContain('-');
  });

  it('includes author from git config', () => {
    const repo = createGitRepo();
    process.chdir(repo);
    expect(getTemplateVariables('main').author).toBe('Test User');
  });

  it('renders branch variable', () => {
    expect(
      renderTemplateContent('# Branch: {{branch}}', {
        branch: 'feature/test',
        date: '2026-01-01',
        author: 'Me',
      }),
    ).toBe('# Branch: feature/test');
  });

  it('renders all variables', () => {
    const result = renderTemplateContent('Branch: {{branch}}\nDate: {{date}}\nAuthor: {{author}}', {
      branch: 'main',
      date: '2026-02-24',
      author: 'Test',
    });
    expect(result).toContain('Branch: main');
    expect(result).toContain('Date: 2026-02-24');
    expect(result).toContain('Author: Test');
  });

  it('preserves unknown variables', () => {
    expect(renderTemplateContent('{{branch}} - {{unknown}}', { branch: 'main' })).toBe(
      'main - {{unknown}}',
    );
  });

  it('preserves content without variables', () => {
    expect(renderTemplateContent('No variables here', { branch: 'main' })).toBe(
      'No variables here',
    );
  });

  it('applies template to current branch through service', () => {
    const repo = createGitRepo();
    expect(gitCheckout(repo, 'origin/main', true).status).toBe(0);
    expect(gitCheckout(repo, 'main').status).toBe(0);
    initBctxWorkspace(repo);
    syncCurrentBranch(repo, { sound: false });
    const contextPath = join(getBranchDir(repo, 'main'), 'context.md');
    writeFileSync(contextPath, 'MODIFIED CONTENT');
    const result = applyTemplateToCurrentBranch(repo, 'feature');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.branch).toBe('main');
    expect(result.template).toBe('feature');
    const content = readFileSync(contextPath, 'utf8');
    expect(content).toContain('## Decisions');
    expect(content).not.toContain('MODIFIED CONTENT');
  });

  it('reports missing config through template service', () => {
    const repo = createGitRepo();
    const result = applyTemplateToCurrentBranch(repo, 'feature');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe(BranchContextActionErrorReason.NotInitialized);
  });
});
