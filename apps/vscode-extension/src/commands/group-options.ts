import * as vscode from 'vscode';

export type GroupByOption<T extends string> = {
  label: string;
  value: T;
};

export async function showGroupByQuickPick<T extends string>(
  options: GroupByOption<T>[],
  current: T,
  placeHolder: string,
) {
  return vscode.window.showQuickPick(
    options.map((option) => ({
      label: option.label,
      description: option.value === current ? 'current' : undefined,
      value: option.value,
    })),
    { placeHolder },
  );
}
