import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import {
  AgentSessionsGroupBy,
  getAgentSessionsGroupBy,
  saveAgentSessionsGroupBy,
} from '../tree-views/agent-sessions';
import { type GroupByOption, showGroupByQuickPick } from './group-options';

const groupByOptions: GroupByOption<AgentSessionsGroupBy>[] = [
  { label: 'Flat', value: AgentSessionsGroupBy.Flat },
  { label: 'Provider', value: AgentSessionsGroupBy.Provider },
  { label: 'Date', value: AgentSessionsGroupBy.Date },
  { label: 'Size', value: AgentSessionsGroupBy.Size },
];

export function registerGroupAgentSessionsCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.groupAgentSessionsBy, async () => {
    try {
      const current = getAgentSessionsGroupBy();
      const selected = await showGroupByQuickPick(
        groupByOptions,
        current,
        'Group agent sessions by',
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
