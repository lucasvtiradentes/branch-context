import { getBranchContextState } from '../core/state';
import { createContextNode, createMessageNode, StateTreeProvider } from './items';

export function createRecentContextsProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized) {
      return [createMessageNode('No .bctx config')];
    }

    if (state.recentContexts.length === 0) {
      return [createMessageNode('No contexts')];
    }

    return state.recentContexts.map((context) =>
      createContextNode(context.branch, context.contextDir, context.updatedAt ?? undefined),
    );
  });
}
