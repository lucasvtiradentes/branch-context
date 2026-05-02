import * as vscode from 'vscode';
import { commandIds } from '../../../constants';
import {
  type GroupByOption,
  showGroupByQuickPick,
} from '../../../shared/command-utils/group-options';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';
import {
  GitCommitsGroupBy,
  getGitCommitsGroupBy,
  saveGitCommitsGroupBy,
} from '../views/git-changes';

const groupByOptions: GroupByOption<GitCommitsGroupBy>[] = [
  { label: 'Flat', value: GitCommitsGroupBy.Flat },
  { label: 'Date', value: GitCommitsGroupBy.Date },
  { label: 'Author', value: GitCommitsGroupBy.Author },
];

export function registerGroupGitCommitsCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupGitCommitsBy, async () => {
    try {
      const current = getGitCommitsGroupBy();
      const selected = await showGroupByQuickPick(groupByOptions, current, 'Group commits by');

      if (!selected) {
        return;
      }

      await saveGitCommitsGroupBy(context, selected.value);
      branchContextState.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
