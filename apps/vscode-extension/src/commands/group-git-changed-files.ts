import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import {
  type GitChangedFilesGroupBy,
  getGitChangedFilesGroupBy,
  saveGitChangedFilesGroupBy,
} from '../tree-views/git-changes';

type GroupByOption = {
  label: string;
  value: GitChangedFilesGroupBy;
};

const groupByOptions: GroupByOption[] = [
  { label: 'Flat', value: 'flat' },
  { label: 'Change Type', value: 'changeType' },
];

export function registerGroupGitChangedFilesCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupGitChangedFilesBy, async () => {
    try {
      const current = getGitChangedFilesGroupBy();
      const selected = await vscode.window.showQuickPick(
        groupByOptions.map((option) => ({
          label: option.label,
          description: option.value === current ? 'current' : undefined,
          value: option.value,
        })),
        {
          placeHolder: 'Group changed files by',
        },
      );

      if (!selected) {
        return;
      }

      await saveGitChangedFilesGroupBy(context, selected.value);
      refreshBranchContextState();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
