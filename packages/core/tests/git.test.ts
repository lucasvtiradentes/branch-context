import { describe, expect, it } from 'vitest';
import { gitCheckout } from '../src/git';
import { gitCurrentBranch, gitInit, normalizeGitRemoteUrl } from '../src/index';
import { createGitRepo, createTempDir, expectOk } from './helpers';

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

  it('returns null in detached head state', () => {
    const repo = createGitRepo();
    expectOk(gitCheckout(repo, 'HEAD~0'));
    expect(gitCurrentBranch(repo)).toBeNull();
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
