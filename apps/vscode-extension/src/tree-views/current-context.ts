import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '@branch-context/core/constants';
import { type BranchContextExtensionState, getBranchContextState } from '../core/state';
import { createMessageNode, readDirectoryNodes, StateTreeProvider } from './items';

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
