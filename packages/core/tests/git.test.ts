import { describe, expect, it } from 'vitest';
import { gitCurrentBranch, gitInit } from '../src/index';
import { createTempDir, expectOk } from './helpers';

describe('git helpers', () => {
  it('gets current branch in empty main repo', () => {
    const repo = createTempDir();
    expectOk(gitInit(repo, 'main'));
    expect(gitCurrentBranch(repo)).toBe('main');
  });

  it('gets current branch in empty custom branch repo', () => {
    const repo = createTempDir();
    expectOk(gitInit(repo, 'develop'));
    expect(gitCurrentBranch(repo)).toBe('develop');
  });

  it('returns null outside git repo', () => {
    expect(gitCurrentBranch(createTempDir())).toBeNull();
  });
});
