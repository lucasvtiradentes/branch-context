import { join } from 'node:path';
import { CONFIG_DIR } from '@branch-context/core';
import {
  createMessageNode,
  createTemplateNode,
  StateTreeProvider,
} from '../../../shared/tree-items';
import { branchContextState } from '../../../vscode/state';
import { getWorkspaceInfo } from '../../../vscode/workspace';

export function createTemplatesProvider(): StateTreeProvider {
  return new StateTreeProvider(() => {
    const state = branchContextState.get();
    if (!state.initialized || !state.workspaceRoot) {
      return [createMessageNode(`No ${CONFIG_DIR} config`)];
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
