import type * as vscode from 'vscode';
import { registerContextCodeLens } from './codelens';
import { initializeContextDecorations } from './decorations';
import { registerContextDocumentSymbols } from './document-symbols';

export function initializeContextFileUx(context: vscode.ExtensionContext): void {
  initializeContextDecorations(context);
  registerContextDocumentSymbols(context);
  registerContextCodeLens(context);
}
