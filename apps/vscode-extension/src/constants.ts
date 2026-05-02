import * as os from 'node:os';
import * as path from 'node:path';

export { CONTEXT_FILE_NAME } from '@branch-context/core';

const APP_ID = 'branch-context';
const APP_LOG_FILENAME = 'extension.log';
export const APP_NAME = 'Branch Context';
export const IS_DEV_EXTENSION = APP_ID.endsWith('-dev');
export const STATUS_BAR_PRIORITY = 10;

export const commandIds = {
  openCurrentContext: `${APP_ID}.openCurrentContext`,
  sync: `${APP_ID}.sync`,
  status: `${APP_ID}.status`,
  setBase: `${APP_ID}.setBase`,
  applyTemplate: `${APP_ID}.applyTemplate`,
  openConfig: `${APP_ID}.openConfig`,
  openCurrentContextFolder: `${APP_ID}.openCurrentContextFolder`,
  reviewDiff: `${APP_ID}.reviewDiff`,
  openCommitDiff: `${APP_ID}.internal.openCommitDiff`,
  copyCommitHash: `${APP_ID}.copyCommitHash`,
  openCommitOnOrigin: `${APP_ID}.openCommitOnOrigin`,
  resetFilesToCommit: `${APP_ID}.resetFilesToCommit`,
  toggleGitChangesMode: `${APP_ID}.toggleGitChangesMode`,
  groupGitChangedFilesBy: `${APP_ID}.groupGitChangedFilesBy`,
  groupGitCommitsBy: `${APP_ID}.groupGitCommitsBy`,
  groupAgentSessionsBy: `${APP_ID}.groupAgentSessionsBy`,
  toggleAgentSessionText: `${APP_ID}.toggleAgentSessionText`,
  resumeAgentSession: `${APP_ID}.resumeAgentSession`,
  pinAgentSession: `${APP_ID}.pinAgentSession`,
  unpinAgentSession: `${APP_ID}.unpinAgentSession`,
  copyAgentSessionId: `${APP_ID}.copyAgentSessionId`,
  deleteAgentSession: `${APP_ID}.deleteAgentSession`,
  groupContextsBy: `${APP_ID}.groupContextsBy`,
  checkoutContextBranch: `${APP_ID}.checkoutContextBranch`,
  openContext: `${APP_ID}.openContext`,
  revealContextFolder: `${APP_ID}.revealContextFolder`,
  archiveContext: `${APP_ID}.archiveContext`,
  restoreContext: `${APP_ID}.restoreContext`,
  deleteContext: `${APP_ID}.deleteContext`,
  showLogs: `${APP_ID}.showLogs`,
  syncAgents: `${APP_ID}.internal.syncAgents`,
  showStatusBarActions: `${APP_ID}.internal.showStatusBarActions`,
  showDetails: `${APP_ID}.internal.showDetails`,
} as const;

export const viewIds = {
  currentContext: `${APP_ID}.currentContext`,
  agentSessions: `${APP_ID}.agentSessions`,
  gitChanges: `${APP_ID}.gitChanges`,
  contexts: `${APP_ID}.contexts`,
  templates: `${APP_ID}.templates`,
} as const;

export const contextKeys = {
  initialized: `${APP_ID}.initialized`,
  gitChangesMode: `${APP_ID}.gitChangesMode`,
} as const;

export const codeLensTitles = {
  sync: 'Sync',
  setBase: 'Set Base',
  applyTemplate: 'Apply Template',
  openConfig: 'Open Config',
} as const;

function getAppLogDirname(appId = APP_ID): string {
  return `.${appId}`;
}

export function getAppLogFilePath(tmpDir = os.tmpdir(), appId = APP_ID): string {
  return path.join(tmpDir, getAppLogDirname(appId), APP_LOG_FILENAME);
}
