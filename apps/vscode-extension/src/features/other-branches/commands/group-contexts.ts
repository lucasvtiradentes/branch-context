import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import {
  type GroupByOption,
  showGroupByQuickPick,
} from '../../../shared/command-utils/group-options';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';
import { ContextsGroupBy, getContextsGroupBy, saveContextsGroupBy } from '../views/contexts';

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
      branchContextState.refresh();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: grouped other branches by ${selected.label}`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
