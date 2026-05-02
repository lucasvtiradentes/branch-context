import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import {
  type GitCommitsGroupBy,
  getGitCommitsGroupBy,
  saveGitCommitsGroupBy,
} from '../tree-views/git-changes';
import type { GroupByOption } from './group-options';

const groupByOptions: GroupByOption<GitCommitsGroupBy>[] = [
  { label: 'Flat', value: 'flat' },
  { label: 'Date', value: 'date' },
  { label: 'Author', value: 'author' },
];

export function registerGroupGitCommitsCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupGitCommitsBy, async () => {
    try {
      const current = getGitCommitsGroupBy();
      const selected = await vscode.window.showQuickPick(
        groupByOptions.map((option) => ({
          label: option.label,
          description: option.value === current ? 'current' : undefined,
          value: option.value,
        })),
        {
          placeHolder: 'Group commits by',
        },
      );

      if (!selected) {
        return;
      }

      await saveGitCommitsGroupBy(context, selected.value);
      refreshBranchContextState();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
