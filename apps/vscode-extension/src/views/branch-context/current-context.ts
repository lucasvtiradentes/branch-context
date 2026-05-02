import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '@branch-context/core';
import { type BranchContextExtensionState, getBranchContextState } from '../../core/state';
import { createMessageNode, readDirectoryNodes, StateTreeProvider } from '../items';

export function createCurrentContextProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    const contextRoot = getCurrentContextRoot(state);
    if (!contextRoot) {
      return [createMessageNode('No current context')];
    }

    return readDirectoryNodes(contextRoot);
  });
}

export function getCurrentContextViewDescription(): string | undefined {
  return getBranchContextState().currentBranch ?? undefined;
}

function getCurrentContextRoot(state: BranchContextExtensionState): string | null {
  if (!state.workspaceRoot) {
    return null;
  }

  const symlinkPath = join(state.workspaceRoot, DEFAULT_SYMLINK);
  if (existsSync(symlinkPath)) {
    return symlinkPath;
  }

  return state.currentContextDir;
}
