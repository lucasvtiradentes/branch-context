import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import {
  type ContextsGroupBy,
  getContextsGroupBy,
  saveContextsGroupBy,
} from '../tree-views/contexts';

type GroupByOption = {
  label: string;
  value: ContextsGroupBy;
};

const groupByOptions: GroupByOption[] = [
  { label: 'Flat', value: 'flat' },
  { label: 'Status', value: 'status' },
  { label: 'Date', value: 'date' },
  { label: 'Size', value: 'size' },
  { label: 'Template', value: 'template' },
];

export function registerGroupContextsCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupContextsBy, async () => {
    try {
      const current = getContextsGroupBy();
      const selected = await vscode.window.showQuickPick(
        groupByOptions.map((option) => ({
          label: option.label,
          description: option.value === current ? 'current' : undefined,
          value: option.value,
        })),
        {
          placeHolder: 'Group other branches by',
        },
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
