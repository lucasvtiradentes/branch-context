import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import { type GroupByOption, showGroupByQuickPick } from '../../../shared/commands/group-options';
import { formatError } from '../../../shared/lib/format/error';
import { branchContextState } from '../../../vscode/state';
import {
  GitChangedFilesGroupBy,
  getGitChangedFilesGroupBy,
  saveGitChangedFilesGroupBy,
} from '../views/git-changes';

const groupByOptions: GroupByOption<GitChangedFilesGroupBy>[] = [
  { label: 'Flat', value: GitChangedFilesGroupBy.Flat },
  { label: 'Change Type', value: GitChangedFilesGroupBy.ChangeType },
];

export function registerGroupGitChangedFilesCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupGitChangedFilesBy, async () => {
    try {
      const current = getGitChangedFilesGroupBy();
      const selected = await showGroupByQuickPick(
        groupByOptions,
        current,
        'Group changed files by',
      );

      if (!selected) {
        return;
      }

      await saveGitChangedFilesGroupBy(context, selected.value);
      branchContextState.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
