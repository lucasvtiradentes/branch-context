import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR, DEFAULT_SYMLINK } from '@branch-context/core';
import {
  createMessageNode,
  readDirectoryNodes,
  StateTreeProvider,
} from '../../../shared/tree-items';
import { type BranchContextExtensionState, branchContextState } from '../../../vscode/state';

export function createCurrentContextProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = branchContextState.get();
    if (!state.initialized) {
      return [createMessageNode(`No ${CONFIG_DIR} config`)];
    }

    const contextRoot = getCurrentContextRoot(state);
    if (!contextRoot) {
      return [createMessageNode('No current context')];
    }

    return readDirectoryNodes(contextRoot);
  });
}

export function getCurrentContextViewDescription(): string | undefined {
  return branchContextState.get().currentBranch ?? undefined;
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
