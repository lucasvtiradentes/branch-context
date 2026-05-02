import { type Dirent, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS_FILE_NAME } from '@branch-context/core';
import * as vscode from 'vscode';
import { createFileNode, createMessageNode } from './nodes';
import { type BranchContextTreeNode, BranchContextTreeNodeKind } from './types';

const MAX_DIRECTORY_ITEMS = 200;

export function readDirectoryNodes(dir: string): BranchContextTreeNode[] {
  if (!existsSync(dir)) {
    return [createMessageNode('Missing')];
  }

  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !isSensitiveFile(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  } catch {
    return [createMessageNode('Unavailable')];
  }

  const visibleEntries = entries.slice(0, MAX_DIRECTORY_ITEMS);
  const nodes = visibleEntries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return {
        label: entry.name,
        kind: BranchContextTreeNodeKind.Folder,
        path,
        tooltip: path,
        icon: new vscode.ThemeIcon('folder'),
        children: () => readDirectoryNodes(path),
      };
    }

    return createFileNode(path, entry.name);
  });

  if (entries.length > visibleEntries.length) {
    nodes.push(createMessageNode(`${entries.length - visibleEntries.length} more hidden`));
  }

  return nodes;
}

function isSensitiveFile(name: string): boolean {
  return (
    name === AGENTS_FILE_NAME ||
    name === '.env' ||
    name.startsWith('.env.') ||
    name.endsWith('.pem') ||
    name.endsWith('.key')
  );
}
