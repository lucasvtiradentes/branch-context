import * as vscode from 'vscode';
import { commandIds } from '../../constants';

const EXTENSION_PUBLISHER = 'lucasvtiradentes';
const EXTENSION_NAME = 'branch-context-vscode';
const MICROSOFT_VSCODE_URI_SCHEME = 'vscode';
const MICROSOFT_VSCODE_APP_NAME = 'visual studio code';
const VSCODE_MARKETPLACE_HOST = 'marketplace.visualstudio.com';
const OPEN_VSX_HOST = 'open-vsx.org';
const EXTENSION_ID = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}`;
const VSCODE_MARKETPLACE_URL = `https://${VSCODE_MARKETPLACE_HOST}/items?itemName=${EXTENSION_ID}`;
const OPEN_VSX_URL = `https://${OPEN_VSX_HOST}/extension/${EXTENSION_PUBLISHER}/${EXTENSION_NAME}`;

export function registerUpdateExtensionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.updateExtension, async () => {
    await vscode.env.openExternal(vscode.Uri.parse(getExtensionUpdateUrl()));
  });
}

function getExtensionUpdateUrl(): string {
  return isMicrosoftVsCode() ? VSCODE_MARKETPLACE_URL : OPEN_VSX_URL;
}

function isMicrosoftVsCode(): boolean {
  const appName = vscode.env.appName.toLowerCase();
  const uriScheme = vscode.env.uriScheme.toLowerCase();
  return appName.includes(MICROSOFT_VSCODE_APP_NAME) || uriScheme === MICROSOFT_VSCODE_URI_SCHEME;
}
