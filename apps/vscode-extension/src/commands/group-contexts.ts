import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format/error';
import {
  ContextsGroupBy,
  getContextsGroupBy,
  saveContextsGroupBy,
} from '../views/other-branches/contexts';
import { type GroupByOption, showGroupByQuickPick } from './group-options';

const groupByOptions: GroupByOption<ContextsGroupBy>[] = [
  { label: 'Flat', value: ContextsGroupBy.Flat },
  { label: 'Status', value: ContextsGroupBy.Status },
  { label: 'Date', value: ContextsGroupBy.Date },
  { label: 'Size', value: ContextsGroupBy.Size },
  { label: 'Template', value: ContextsGroupBy.Template },
];

export function registerGroupContextsCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupContextsBy, async () => {
    try {
      const current = getContextsGroupBy();
      const selected = await showGroupByQuickPick(
        groupByOptions,
        current,
        'Group other branches by',
      );

      if (!selected) {
        return;
      }

      await saveContextsGroupBy(context, selected.value);
      refreshBranchContextState();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: grouped other branches by ${selected.label}`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
