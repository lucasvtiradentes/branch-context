import { describe, expect, it } from 'vitest';
import { getTemplateVariables, renderTemplateContent } from '../src/index';
import { createGitRepo } from './helpers';

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
});
