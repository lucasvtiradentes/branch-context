export { CONTEXT_FILE_NAME } from '@branch-context/core/constants';

const APP_ID = 'branch-context';
export const APP_NAME = 'Branch Context';
export const STATUS_BAR_PRIORITY = 100;
export const STATUS_BAR_MAX_CONTEXT_LENGTH = 40;

export const commandIds = {
  openCurrentContext: `${APP_ID}.openCurrentContext`,
  sync: `${APP_ID}.sync`,
  status: `${APP_ID}.status`,
  setBase: `${APP_ID}.setBase`,
  applyTemplate: `${APP_ID}.applyTemplate`,
  openConfig: `${APP_ID}.openConfig`,
  openCurrentContextFolder: `${APP_ID}.openCurrentContextFolder`,
  groupContextsBy: `${APP_ID}.groupContextsBy`,
  checkoutContextBranch: `${APP_ID}.checkoutContextBranch`,
  openContext: `${APP_ID}.openContext`,
  revealContextFolder: `${APP_ID}.revealContextFolder`,
  archiveContext: `${APP_ID}.archiveContext`,
  restoreContext: `${APP_ID}.restoreContext`,
  deleteContext: `${APP_ID}.deleteContext`,
  showDetails: `${APP_ID}.internal.showDetails`,
} as const;

export const viewIds = {
  currentContext: `${APP_ID}.currentContext`,
  contexts: `${APP_ID}.contexts`,
  templates: `${APP_ID}.templates`,
} as const;

export const codeLensTitles = {
  sync: 'Sync',
  setBase: 'Set Base',
  applyTemplate: 'Apply Template',
  openConfig: 'Open Config',
} as const;
