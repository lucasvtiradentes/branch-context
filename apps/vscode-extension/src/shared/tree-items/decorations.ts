import * as vscode from 'vscode';
import { getTreeItemResourceTooltip, isDecoratedTreeItemResourceScheme } from './types';

export function initializeTreeItemDecorations(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider({
      provideFileDecoration(uri) {
        if (!isDecoratedTreeItemResourceScheme(uri.scheme)) {
          return undefined;
        }

        return new vscode.FileDecoration(
          undefined,
          getTreeItemResourceTooltip(uri.scheme),
          new vscode.ThemeColor('disabledForeground'),
        );
      },
    }),
  );
}
