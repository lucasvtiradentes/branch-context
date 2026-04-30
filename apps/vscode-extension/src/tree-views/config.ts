import { getBranchContextState } from '../core/state';
import { createConfigNode, createMessageNode, StateTreeProvider } from './items';

export function createConfigProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized || !state.configPath) {
      return [createMessageNode('No .bctx config')];
    }

    return [createConfigNode(state.configPath)];
  });
}
