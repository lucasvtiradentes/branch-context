import { execFileSync } from 'node:child_process';

const GITHUB_HOST = 'github.com';
const GITLAB_HOST = 'gitlab.com';

export type GitRemoteRef = {
  host: string;
  owner: string;
  repo: string;
};

export function gitOriginUrl(workspaceRoot: string): string | null {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function gitCommitRemoteUrl(workspaceRoot: string, hash: string): string | null {
  const remoteUrl = gitOriginUrl(workspaceRoot);
  if (!remoteUrl) {
    return null;
  }

  const normalized = normalizeGitRemoteUrl(remoteUrl);
  if (!normalized) {
    return null;
  }

  if (normalized.host === GITHUB_HOST) {
    return `https://${GITHUB_HOST}/${normalized.owner}/${normalized.repo}/commit/${hash}`;
  }

  if (normalized.host === GITLAB_HOST) {
    return `https://${GITLAB_HOST}/${normalized.owner}/${normalized.repo}/-/commit/${hash}`;
  }

  return null;
}

export function normalizeGitRemoteUrl(remoteUrl: string): GitRemoteRef | null {
  const sshMatch = /^(?:git@|ssh:\/\/git@)([^:/]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    if (!host || !owner || !repo) {
      return null;
    }
    return {
      host,
      owner,
      repo,
    };
  }

  try {
    const url = new URL(remoteUrl);
    const parts = url.pathname.replace(/^\/|\.git$/g, '').split('/');
    if (parts.length < 2) {
      return null;
    }
    return {
      host: url.hostname,
      owner: parts.at(-2) ?? '',
      repo: parts.at(-1) ?? '',
    };
  } catch {
    return null;
  }
}
