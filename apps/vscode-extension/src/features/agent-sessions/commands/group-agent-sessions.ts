import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../../../constants';
import {
  type GroupByOption,
  showGroupByQuickPick,
} from '../../../shared/command-utils/group-options';
import { formatError } from '../../../shared/format/error';
import { branchContextState } from '../../../vscode/state';
import {
  AgentSessionsGroupBy,
  getAgentSessionsGroupBy,
  saveAgentSessionsGroupBy,
} from '../views/agent-sessions';

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
      branchContextState.refresh();
      await vscode.window.showInformationMessage(
        `${APP_NAME}: grouped agent sessions by ${selected.label}`,
      );
    } catch (error) {
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}
