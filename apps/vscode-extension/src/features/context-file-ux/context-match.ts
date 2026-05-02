import { relative, sep } from 'node:path';
import { ARCHIVED_DIR, BRANCHES_DIR, CONFIG_DIR, DEFAULT_SYMLINK } from '@branch-context/core';
import * as vscode from 'vscode';
import { CONTEXT_FILE_NAME } from '../../constants';

export const contextDocumentSelector: vscode.DocumentSelector = [
  {
    scheme: 'file',
    language: 'markdown',
  },
];

export function isContextDocument(document: vscode.TextDocument): boolean {
  if (document.uri.scheme !== 'file') {
    return false;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (isContextPath(relative(folder.uri.fsPath, document.uri.fsPath))) {
      return true;
    }
  }

  return false;
}

function isContextPath(path: string): boolean {
  const normalized = path.split(sep).join('/');
  const parts = normalized.split('/');

  if (normalized === `${DEFAULT_SYMLINK}/${CONTEXT_FILE_NAME}`) {
    return true;
  }

  if (
    parts.length === 4 &&
    parts[0] === CONFIG_DIR &&
    parts[1] === BRANCHES_DIR &&
    parts[3] === CONTEXT_FILE_NAME
  ) {
    return true;
  }

  return (
    parts.length === 5 &&
    parts[0] === CONFIG_DIR &&
    parts[1] === BRANCHES_DIR &&
    parts[2] === ARCHIVED_DIR &&
    parts[4] === CONTEXT_FILE_NAME
  );
}
