import * as vscode from 'vscode';
import { codeLensTitles, commandIds } from '../../constants';
import { contextDocumentSelector, isContextDocument } from './context-match';

export function registerContextCodeLens(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      contextDocumentSelector,
      new ContextCodeLensProvider(),
    ),
  );
}

class ContextCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!isContextDocument(document)) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, {
        title: codeLensTitles.sync,
        command: commandIds.sync,
      }),
      new vscode.CodeLens(range, {
        title: codeLensTitles.setBase,
        command: commandIds.setBase,
      }),
      new vscode.CodeLens(range, {
        title: codeLensTitles.applyTemplate,
        command: commandIds.applyTemplate,
      }),
      new vscode.CodeLens(range, {
        title: codeLensTitles.openConfig,
        command: commandIds.openConfig,
      }),
    ];
  }
}
