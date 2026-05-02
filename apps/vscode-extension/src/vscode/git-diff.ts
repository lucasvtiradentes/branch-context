import { join } from 'node:path';
import type { GitChangedFileSummary, GitCommitSummary } from '@branch-context/core';
import {
  GitFileStatus,
  gitChangedFileSummariesBetween,
  gitCommitParentRef,
  gitFileContent,
  gitMergeBase,
} from '@branch-context/core';
import * as vscode from 'vscode';

const gitContentScheme = 'branch-context-git';

type GitContentRequest = {
  workspaceRoot: string;
  ref: string;
  path: string;
};

type ChangeResource = [vscode.Uri, vscode.Uri | undefined, vscode.Uri | undefined];

export function initializeGitDiffProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(gitContentScheme, {
      provideTextDocumentContent(uri) {
        const request = parseGitContentRequest(uri);
        if (!request) {
          return '';
        }

        return gitFileContent(request.workspaceRoot, request.ref, request.path) ?? '';
      },
    }),
  );
}

export async function openCommitChanges(
  workspaceRoot: string,
  commit: GitCommitSummary,
): Promise<boolean> {
  const parentRef = gitCommitParentRef(workspaceRoot, commit.hash);
  if (!parentRef) {
    return false;
  }

  const files = gitChangedFileSummariesBetween(workspaceRoot, parentRef, commit.hash);
  return openGitChanges(`${commit.subject}`, workspaceRoot, parentRef, commit.hash, files);
}

export async function openBranchChanges(
  workspaceRoot: string,
  baseBranch: string,
  files: GitChangedFileSummary[],
): Promise<boolean> {
  const mergeBase = gitMergeBase(workspaceRoot, baseBranch) ?? baseBranch;
  return openGitChanges(
    `Branch diff: ${baseBranch}...HEAD`,
    workspaceRoot,
    mergeBase,
    'HEAD',
    files,
  );
}

async function openGitChanges(
  title: string,
  workspaceRoot: string,
  leftRef: string,
  rightRef: string,
  files: GitChangedFileSummary[],
) {
  const resources = files.map((file) =>
    createChangeResource(workspaceRoot, leftRef, rightRef, file),
  );
  if (resources.length === 0) {
    return false;
  }

  await vscode.commands.executeCommand('vscode.changes', title, resources);
  return true;
}

function createChangeResource(
  workspaceRoot: string,
  leftRef: string,
  rightRef: string,
  file: GitChangedFileSummary,
): ChangeResource {
  const leftPath = file.oldPath ?? file.path;
  const labelPath = file.status === GitFileStatus.Deleted ? leftPath : file.path;
  return [
    vscode.Uri.file(join(workspaceRoot, labelPath)),
    createGitContentUri(workspaceRoot, leftRef, leftPath),
    createGitContentUri(workspaceRoot, rightRef, file.path),
  ];
}

function createGitContentUri(workspaceRoot: string, ref: string, filePath: string) {
  const request: GitContentRequest = {
    workspaceRoot,
    ref,
    path: filePath,
  };

  return vscode.Uri.from({
    scheme: gitContentScheme,
    authority: 'file',
    path: `/${filePath}`,
    query: Buffer.from(JSON.stringify(request), 'utf8').toString('base64url'),
  });
}

function parseGitContentRequest(uri: vscode.Uri): GitContentRequest | null {
  try {
    const parsed = JSON.parse(Buffer.from(uri.query, 'base64url').toString('utf8')) as unknown;
    if (!isGitContentRequest(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isGitContentRequest(value: unknown): value is GitContentRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as GitContentRequest;
  return (
    typeof request.workspaceRoot === 'string' &&
    typeof request.ref === 'string' &&
    typeof request.path === 'string'
  );
}
