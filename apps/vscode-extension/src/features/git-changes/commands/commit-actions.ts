import { execFileSync, spawnSync } from 'node:child_process';
import type { GitCommitSummary } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import { getInitializedState } from '../../../shared/commands/helpers';
import { formatError } from '../../../shared/lib/format/error';
import type { BranchContextTreeNodeDraft } from '../../../shared/tree/items';
import { branchContextState } from '../../../vscode/state';

const GITHUB_HOST = 'github.com';
const GITLAB_HOST = 'gitlab.com';

export function registerCommitActionCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(commandIds.copyCommitHash, copyCommitHash),
    vscode.commands.registerCommand(commandIds.openCommitOnOrigin, openCommitOnOrigin),
    vscode.commands.registerCommand(commandIds.resetFilesToCommit, resetFilesToCommit),
  ];
}

async function copyCommitHash(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  await vscode.env.clipboard.writeText(commit.hash);
}

async function openCommitOnOrigin(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  try {
    const state = await getInitializedState();
    if (!state?.workspaceRoot) {
      return;
    }

    const url = getCommitOriginUrl(state.workspaceRoot, commit.hash);
    if (!url) {
      await vscode.window.showErrorMessage(`${APP_NAME}: origin is not GitHub or GitLab`);
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

async function resetFilesToCommit(node: unknown): Promise<void> {
  const commit = getCommit(node);
  if (!commit) {
    await vscode.window.showErrorMessage('Missing commit metadata.');
    return;
  }

  try {
    const state = await getInitializedState();
    if (!state?.workspaceRoot) {
      return;
    }

    const dirty = isWorktreeDirty(state.workspaceRoot);
    const warning = dirty
      ? `This will overwrite current working tree changes with ${commit.shortHash}.`
      : `This will restore all files from ${commit.shortHash}.`;
    const confirmed = await vscode.window.showWarningMessage(
      `Reset Files To Commit? ${warning}`,
      { modal: true },
      'Reset Files',
    );
    if (confirmed !== 'Reset Files') {
      return;
    }

    const result = spawnSync('git', ['restore', `--source=${commit.hash}`, '.'], {
      cwd: state.workspaceRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || 'git restore failed');
    }

    branchContextState.refresh();
  } catch (error) {
    await vscode.window.showErrorMessage(formatError(error));
  }
}

function getCommit(node: unknown): GitCommitSummary | null {
  const treeNode = node as BranchContextTreeNodeDraft | undefined;
  return treeNode?.commit ?? null;
}

function isWorktreeDirty(workspaceRoot: string): boolean {
  const output = execFileSync('git', ['status', '--porcelain'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  return output.trim().length > 0;
}

function getCommitOriginUrl(workspaceRoot: string, hash: string): string | null {
  const remoteUrl = getOriginUrl(workspaceRoot);
  if (!remoteUrl) {
    return null;
  }

  const normalized = normalizeRemoteUrl(remoteUrl);
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

function getOriginUrl(workspaceRoot: string): string | null {
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

function normalizeRemoteUrl(remoteUrl: string) {
  const sshMatch = /^(?:git@|ssh:\/\/git@)([^:/]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch) {
    return {
      host: sshMatch[1],
      owner: sshMatch[2],
      repo: sshMatch[3],
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
