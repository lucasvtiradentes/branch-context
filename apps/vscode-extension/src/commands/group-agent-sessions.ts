import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import {
  type AgentSessionsGroupBy,
  getAgentSessionsGroupBy,
  saveAgentSessionsGroupBy,
} from '../tree-views/agent-sessions';

type GroupByOption = {
  label: string;
  value: AgentSessionsGroupBy;
};

const groupByOptions: GroupByOption[] = [
  { label: 'Provider', value: 'provider' },
  { label: 'Recent', value: 'recent' },
  { label: 'Size', value: 'size' },
];

export function registerGroupAgentSessionsCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupAgentSessionsBy, async () => {
    try {
      const current = getAgentSessionsGroupBy();
      const selected = await vscode.window.showQuickPick(
        groupByOptions.map((option) => ({
          label: option.label,
          description: option.value === current ? 'current' : undefined,
          value: option.value,
        })),
        {
          placeHolder: 'Group agent sessions by',
        },
      );

      if (!selected) {
        return;
      }

      await saveAgentSessionsGroupBy(context, selected.value);
      refreshBranchContextState();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: grouped agent sessions by ${selected.label}`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
