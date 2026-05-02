import { applyTemplateToCurrentBranch, listAvailableTemplates } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { formatError } from '../lib/format/error';
import { refreshBranchContextState } from '../state/state';
import { formatActionError, getInitializedState } from './helpers';

export function registerApplyTemplateCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.applyTemplate, async () => {
    try {
      const state = await getInitializedState();
      if (!state?.workspaceRoot) {
        return;
      }

      const templatesResult = listAvailableTemplates(state.workspaceRoot);
      if (!templatesResult.ok) {
        await vscode.window.showErrorMessage(formatActionError(templatesResult));
        return;
      }

      if (templatesResult.templates.length === 0) {
        await vscode.window.showErrorMessage(`${APP_NAME}: no templates found`);
        return;
      }

      const template = await vscode.window.showQuickPick(templatesResult.templates, {
        placeHolder: 'Template',
      });

      if (!template) {
        return;
      }

      const result = applyTemplateToCurrentBranch(state.workspaceRoot, template);
      if (!result.ok) {
        await vscode.window.showErrorMessage(formatActionError(result));
        return;
      }

      refreshBranchContextState();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: applied '${result.template}' to '${result.branch}'`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
