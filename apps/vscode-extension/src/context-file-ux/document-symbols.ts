import * as vscode from 'vscode';
import { contextDocumentSelector, isContextDocument } from './context-match';

type HeadingEntry = {
  level: number;
  symbol: vscode.DocumentSymbol;
};

export function registerContextDocumentSymbols(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      contextDocumentSelector,
      new ContextDocumentSymbolProvider(),
    ),
  );
}

class ContextDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    if (!isContextDocument(document)) {
      return [];
    }

    const roots: vscode.DocumentSymbol[] = [];
    const stack: HeadingEntry[] = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
      const line = document.lineAt(lineIndex);
      const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.text);
      if (!match) {
        continue;
      }

      const hashes = match[1];
      const title = match[2];
      if (!hashes || !title) {
        continue;
      }

      const level = hashes.length;
      const range = line.range;
      const symbol = new vscode.DocumentSymbol(title, '', vscode.SymbolKind.String, range, range);

      while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= level) {
        stack.pop();
      }

      const parent = stack.at(-1)?.symbol;
      if (parent) {
        parent.children.push(symbol);
      } else {
        roots.push(symbol);
      }

      stack.push({ level, symbol });
    }

    return roots;
  }
}
