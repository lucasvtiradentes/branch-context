import * as vscode from 'vscode';
import { isContextDocument } from './context-match';

const MANAGED_TAG_PATTERN = /<bctx:(commits|files)>[\s\S]*?<\/bctx:\1>/g;

export function initializeContextDecorations(context: vscode.ExtensionContext): void {
  const decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editorWidget.border'),
    isWholeLine: false,
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  context.subscriptions.push(decoration);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateVisibleEditors(decoration)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === event.document) {
          updateEditor(editor, decoration);
        }
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => updateVisibleEditors(decoration)),
  );

  updateVisibleEditors(decoration);
}

function updateVisibleEditors(decoration: vscode.TextEditorDecorationType): void {
  for (const editor of vscode.window.visibleTextEditors) {
    updateEditor(editor, decoration);
  }
}

function updateEditor(
  editor: vscode.TextEditor,
  decoration: vscode.TextEditorDecorationType,
): void {
  if (!isContextDocument(editor.document)) {
    editor.setDecorations(decoration, []);
    return;
  }

  editor.setDecorations(decoration, getManagedTagRanges(editor.document));
}

function getManagedTagRanges(document: vscode.TextDocument): vscode.Range[] {
  const text = document.getText();
  return Array.from(text.matchAll(MANAGED_TAG_PATTERN)).flatMap((match) => {
    if (match.index == null) {
      return [];
    }

    return [
      new vscode.Range(
        document.positionAt(match.index),
        document.positionAt(match.index + match[0].length),
      ),
    ];
  });
}
