export const DIST_NAME = 'branch-ctx';
export const PACKAGE_NAME = '@branch-context/core';
export const CLI_NAME = 'bctx';
export const VERSION = '0.3.2';

export const GIT_DIR = '.git';
export const HOOK_MARKER = '# branch-ctx-managed';
export enum HookType {
  PostCheckout = 'post-checkout',
  PostCommit = 'post-commit',
}

export const HOOK_POST_CHECKOUT = HookType.PostCheckout;
export const HOOK_POST_COMMIT = HookType.PostCommit;
export const DEFAULT_SOUND_FILE = 'notification.oga';

export const CONFIG_DIR = '.bctx';
export const CONFIG_FILE = 'config.json';
export const META_FILE = 'meta.json';
export const TEMPLATES_DIR = 'templates';
export const BRANCHES_DIR = 'branches';
export const ARCHIVED_DIR = '_archived';

export const DEFAULT_SYMLINK = '_branch';
export const CONTEXT_FILE_NAME = 'context.md';
export const AGENTS_FILE_NAME = 'agents.json';
export const DEFAULT_TEMPLATE = '_default';
export const DEFAULT_BASE_BRANCH = 'main';
export const BASE_BRANCH_FILE = 'base_branch';

export const TEMPLATE_FILE_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml'];
export const CONTEXT_FILE_EXTENSIONS = ['.md', '.txt'];
