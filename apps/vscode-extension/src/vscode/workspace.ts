import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARCHIVED_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_SYMLINK,
  getBranchesDir,
  getTemplatesDir,
  META_FILE,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { CONTEXT_FILE_NAME } from '../constants';

type BranchContextWorkspaceInfo = {
  workspaceRoot: string | null;
  bctxDir: string | null;
  branchSymlinkPath: string | null;
  currentContextFile: string | null;
  configPath: string | null;
  branchesDir: string | null;
  branchesMetaPath: string | null;
  archivedDir: string | null;
  archivedMetaPath: string | null;
  templatesDir: string | null;
};

function getWorkspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

export function getWorkspaceInfo(workspaceRoot = getWorkspaceRoot()): BranchContextWorkspaceInfo {
  if (!workspaceRoot) {
    return emptyWorkspaceInfo();
  }

  const bctxDir = join(workspaceRoot, CONFIG_DIR);
  const branchSymlinkPath = join(workspaceRoot, DEFAULT_SYMLINK);
  const branchesDir = getBranchesDir(workspaceRoot);
  const archivedDir = join(branchesDir, ARCHIVED_DIR);
  const templatesDir = getTemplatesDir(workspaceRoot);
  const currentContextFile = getCurrentContextFile(branchSymlinkPath);

  return {
    workspaceRoot,
    bctxDir,
    branchSymlinkPath,
    currentContextFile,
    configPath: join(bctxDir, CONFIG_FILE),
    branchesDir,
    branchesMetaPath: join(branchesDir, META_FILE),
    archivedDir,
    archivedMetaPath: join(archivedDir, META_FILE),
    templatesDir,
  };
}

function emptyWorkspaceInfo(): BranchContextWorkspaceInfo {
  return {
    workspaceRoot: null,
    bctxDir: null,
    branchSymlinkPath: null,
    currentContextFile: null,
    configPath: null,
    branchesDir: null,
    branchesMetaPath: null,
    archivedDir: null,
    archivedMetaPath: null,
    templatesDir: null,
  };
}

function getCurrentContextFile(branchSymlinkPath: string): string | null {
  const contextFile = join(branchSymlinkPath, CONTEXT_FILE_NAME);
  return existsSync(contextFile) ? contextFile : null;
}
