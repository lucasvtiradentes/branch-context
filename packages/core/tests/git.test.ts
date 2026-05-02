import { describe, expect, it } from 'vitest';
import { gitCurrentBranch, gitInit, normalizeGitRemoteUrl } from '../src/index';
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

  it('normalizes common remote urls', () => {
    expect(normalizeGitRemoteUrl('git@github.com:owner/repo.git')).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
    });
    expect(normalizeGitRemoteUrl('https://gitlab.com/group/repo.git')).toEqual({
      host: 'gitlab.com',
      owner: 'group',
      repo: 'repo',
    });
    expect(normalizeGitRemoteUrl('not-a-url')).toBeNull();
  });
});
