import { getBranchContextState } from '../core/state';
import { createContextNode, createMessageNode, StateTreeProvider } from './items';

export function createArchivedContextsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    if (state.archivedContexts.length === 0) {
      return [createMessageNode('No archived contexts')];
    }

    return state.archivedContexts.map((context) =>
      createContextNode(context.branch, context.contextDir, context.updatedAt ?? undefined),
    );
  });
}
