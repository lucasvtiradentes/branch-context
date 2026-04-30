import { join } from 'node:path';
import { getBranchContextState } from '../core/state';
import { getWorkspaceInfo } from '../core/workspace';
import { createMessageNode, createTemplateNode, StateTreeProvider } from './items';

export function createTemplatesProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = getBranchContextState();
    if (!state.initialized || !state.workspaceRoot) {
      return [createMessageNode('No .bctx config')];
    }

    if (state.templates.length === 0) {
      return [createMessageNode('No templates')];
    }

    const workspace = getWorkspaceInfo(state.workspaceRoot);
    if (!workspace.templatesDir) {
      return [createMessageNode('No templates')];
    }

    const templatesDir = workspace.templatesDir;
    return state.templates.map((template) =>
      createTemplateNode(template, join(templatesDir, template)),
    );
  });
}
