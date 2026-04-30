export const APP_ID = 'branch-context';
export const APP_NAME = 'Branch Context';
export const CONTEXT_FILE_NAME = 'context.md';
export const STATUS_BAR_PRIORITY = 100;
export const STATUS_BAR_MAX_CONTEXT_LENGTH = 40;

export const commandIds = {
  openCurrentContext: `${APP_ID}.openCurrentContext`,
  sync: `${APP_ID}.sync`,
  status: `${APP_ID}.status`,
  setBase: `${APP_ID}.setBase`,
  applyTemplate: `${APP_ID}.applyTemplate`,
  openConfig: `${APP_ID}.openConfig`,
  refreshViews: `${APP_ID}.refreshViews`,
  showDetails: `${APP_ID}.internal.showDetails`,
} as const;

export const viewIds = {
  currentContext: `${APP_ID}.views.currentContext`,
  recentContexts: `${APP_ID}.views.recentContexts`,
  archivedContexts: `${APP_ID}.views.archivedContexts`,
  templates: `${APP_ID}.views.templates`,
  configs: `${APP_ID}.views.configs`,
} as const;
