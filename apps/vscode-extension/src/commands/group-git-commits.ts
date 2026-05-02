import * as vscode from 'vscode';
import { commandIds } from '../constants';
import { formatError } from '../lib/format/error';
import { refreshBranchContextState } from '../state/state';
import {
  GitCommitsGroupBy,
  getGitCommitsGroupBy,
  saveGitCommitsGroupBy,
} from '../views/branch-git-changes/git-changes';
import { type GroupByOption, showGroupByQuickPick } from './group-options';

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
      refreshBranchContextState();
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
