import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, join, sep as pathSeparator, relative } from 'node:path';
import {
  CONTEXT_FILE_NAME,
  DEFAULT_SYMLINK,
  DEFAULT_TEMPLATE,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
} from '../constants';
import { getCurrentBranch, isHookInstalled } from '../core/hooks';
import { getArchivedDir, getBranchDir, listArchivedBranches } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import {
  Config,
  configExists,
  getBranchesDir,
  getConfigDir,
  getTemplatesDir,
  getWorkspaceGlobalPath,
  listTemplates,
} from '../data/config';
import { loadArchivedMeta, loadBranchMeta } from '../data/meta';
import { gitRefExists } from '../git';
import { type BranchInfo, collectBranchInfo } from './branch-info';

export type BranchContextStatusIssue = {
  level: BranchContextStatusIssueLevel;
  message: string;
};

export enum BranchContextStatusIssueLevel {
  Error = 'error',
  Warning = 'warning',
}

export type BranchContextSymlinkStatus = {
  path: string;
  target: string | null;
  state: BranchContextSymlinkState;
};

export enum BranchContextSymlinkState {
  Valid = 'valid',
  Missing = 'missing',
  Broken = 'broken',
  NotSymlink = 'not_symlink',
}

export type BranchContextHooksStatus = {
  checkout: boolean;
  commit: boolean;
};

export type BranchContextContextSummary = {
  branch: string;
  branchKey: string;
  contextDir: string;
  updatedAt: string | null;
  template: string;
  commitCount: number;
  changedFileCount: number;
  sizeBytes: number;
  current: boolean;
  local: boolean;
  remote: boolean;
};

export type BranchContextArchivedContextSummary = {
  branch: string;
  branchKey: string;
  contextDir: string;
  updatedAt: string | null;
  template: string;
  commitCount: number;
  changedFileCount: number;
  sizeBytes: number;
};

type ContextSummaryOrderSource = Pick<BranchContextContextSummary, 'branch' | 'updatedAt'>;

export type BranchContextStatus = {
  gitRoot: string;
  initialized: boolean;
  mode: 'local' | 'global';
  globalPath: string | null;
  repoStorageDir: string;
  templatesDir: string;
  branchesDir: string;
  currentBranch: string | null;
  currentContextDir: string | null;
  currentContextRelPath: string | null;
  baseBranch: string | null;
  templates: string[];
  templatesDirExists: boolean;
  defaultTemplateExists: boolean;
  hooks: BranchContextHooksStatus;
  symlink: BranchContextSymlinkStatus;
  issues: BranchContextStatusIssue[];
  contexts: Map<string, BranchInfo>;
  recentContexts: BranchContextContextSummary[];
  archivedContexts: BranchContextArchivedContextSummary[];
  archivedCount: number;
};

export function getStatus(gitRoot: string): BranchContextStatus {
  const initialized = configExists(gitRoot);
  const globalPath = getWorkspaceGlobalPath(gitRoot);
  const mode = globalPath ? 'global' : 'local';
  const repoStorageDir = getExistingRealPath(getConfigDir(gitRoot));
  const templatesDir = getTemplatesDir(gitRoot);
  const branchesDir = getBranchesDir(gitRoot);
  const currentBranch = getCurrentBranch(gitRoot);
  const currentContextDir =
    initialized && currentBranch ? getBranchDir(gitRoot, currentBranch) : null;
  const currentContextRelPath = currentContextDir
    ? getWorkspaceRelativePath(gitRoot, currentContextDir)
    : null;
  const templates = initialized ? listTemplates(gitRoot) : [];
  const templatesDirExists = initialized ? existsSync(templatesDir) : false;
  const defaultTemplateExists = existsSync(join(templatesDir, DEFAULT_TEMPLATE, CONTEXT_FILE_NAME));
  const hooks = {
    checkout: initialized ? isHookInstalled(gitRoot, HOOK_POST_CHECKOUT) : false,
    commit: initialized ? isHookInstalled(gitRoot, HOOK_POST_COMMIT) : false,
  };
  const symlink = getSymlinkStatus(gitRoot);
  const contexts = initialized ? collectBranchInfo(gitRoot) : new Map<string, BranchInfo>();
  const recentContexts = initialized ? getContextSummaries(gitRoot, currentBranch, contexts) : [];
  const archivedContexts = initialized ? getArchivedContextSummaries(gitRoot) : [];
  const archivedCount = archivedContexts.length;
  const baseBranch = currentContextDir ? getBaseBranch(gitRoot, currentContextDir) : null;
  const issues: BranchContextStatusIssue[] = [];

  if (!initialized) {
    issues.push({ level: BranchContextStatusIssueLevel.Error, message: 'not initialized' });
  } else {
    if (!hooks.checkout) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: `${HOOK_POST_CHECKOUT} hook not installed`,
      });
    }

    if (!hooks.commit) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: `${HOOK_POST_COMMIT} hook not installed`,
      });
    }

    if (!templatesDirExists) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: `templates folder missing: ${templatesDir}`,
      });
    }

    if (!defaultTemplateExists) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: `${DEFAULT_TEMPLATE} template missing: ${join(templatesDir, DEFAULT_TEMPLATE, CONTEXT_FILE_NAME)}`,
      });
    }

    if (symlink.state === BranchContextSymlinkState.Broken) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: 'symlink points to non-existent target',
      });
    } else if (symlink.state === BranchContextSymlinkState.NotSymlink) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: 'symlink path exists but is not a symlink',
      });
    } else if (symlink.state === BranchContextSymlinkState.Missing) {
      issues.push({ level: BranchContextStatusIssueLevel.Warning, message: 'symlink not set' });
    }

    if (baseBranch && !gitRefExists(gitRoot, baseBranch)) {
      issues.push({
        level: BranchContextStatusIssueLevel.Error,
        message: `base branch not found: ${baseBranch}`,
      });
    }

    const orphanCount = Array.from(contexts.entries()).filter(
      ([, info]) => info.context && !info.local,
    ).length;
    if (orphanCount > 0) {
      issues.push({
        level: BranchContextStatusIssueLevel.Warning,
        message: `${orphanCount} orphan contexts`,
      });
    }
  }

  return {
    gitRoot,
    initialized,
    mode,
    globalPath,
    repoStorageDir,
    templatesDir,
    branchesDir,
    currentBranch,
    currentContextDir,
    currentContextRelPath,
    baseBranch,
    templates,
    templatesDirExists,
    defaultTemplateExists,
    hooks,
    symlink,
    issues,
    contexts,
    recentContexts,
    archivedContexts,
    archivedCount,
  };
}

function getExistingRealPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function getContextSummaries(
  gitRoot: string,
  currentBranch: string | null,
  contexts: Map<string, BranchInfo>,
): BranchContextContextSummary[] {
  const meta = loadBranchMeta(gitRoot);
  const config = Config.load(gitRoot);
  const resolveTemplate = createContextTemplateResolver(gitRoot, config);

  return Array.from(contexts.entries())
    .filter(([, info]) => info.context)
    .map(([branch, info]) => {
      const branchMeta = meta[info.sanitized];
      const contextDir = join(getBranchesDir(gitRoot), info.sanitized);
      return {
        branch,
        branchKey: info.sanitized,
        contextDir,
        updatedAt: branchMeta?.updated_at ?? null,
        template: resolveTemplate(branch, contextDir),
        commitCount: countMetaLines(branchMeta?.commits),
        changedFileCount: countMetaLines(branchMeta?.changed_files),
        sizeBytes: getDirectorySize(contextDir),
        current: branch === currentBranch,
        local: info.local,
        remote: info.remote,
      };
    })
    .sort(compareContexts);
}

function getArchivedContextSummaries(gitRoot: string): BranchContextArchivedContextSummary[] {
  const archivedMeta = loadArchivedMeta(gitRoot);
  const archivedDir = getArchivedDir(gitRoot);
  const config = Config.load(gitRoot);
  const resolveTemplate = createContextTemplateResolver(gitRoot, config);

  return listArchivedBranches(gitRoot)
    .map((branchKey) => {
      const meta = archivedMeta[branchKey];
      const branch = meta?.branch ?? branchKey;
      const contextDir = join(archivedDir, branchKey);
      return {
        branch,
        branchKey,
        contextDir,
        updatedAt: meta?.updated_at ?? null,
        template: resolveTemplate(branch, contextDir),
        commitCount: countMetaLines(meta?.commits),
        changedFileCount: countMetaLines(meta?.changed_files),
        sizeBytes: getDirectorySize(contextDir),
      };
    })
    .sort(compareArchivedContexts);
}

type ContentSignature = {
  comment: string | null;
  headings: string[];
};

type TemplateSignature = ContentSignature & {
  name: string;
};

function createContextTemplateResolver(gitRoot: string, config: Config) {
  const templates = listTemplates(gitRoot);
  const templateSet = new Set(templates);
  const templateSignatures = templates.flatMap((template) => {
    const content = readTextFile(join(getTemplatesDir(gitRoot), template, CONTEXT_FILE_NAME));
    return content ? [{ name: template, ...createContentSignature(content) }] : [];
  });

  return (branch: string, contextDir: string) => {
    const branchTemplate = config.getTemplateForBranch(branch, templates);
    const content = readTextFile(join(contextDir, CONTEXT_FILE_NAME));
    if (!content) {
      return branchTemplate;
    }

    const frontmatterTemplate = getFrontmatterTemplate(content);
    if (frontmatterTemplate && templateSet.has(frontmatterTemplate)) {
      return frontmatterTemplate;
    }

    return inferTemplateFromContent(content, templateSignatures, branchTemplate) ?? branchTemplate;
  };
}

function inferTemplateFromContent(
  content: string,
  templateSignatures: TemplateSignature[],
  branchTemplate: string,
) {
  const signature = createContentSignature(content);
  const scores = templateSignatures
    .map((template) => ({ name: template.name, score: scoreTemplate(signature, template) }))
    .filter((template) => template.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const best = scores[0];
  if (!best) {
    return null;
  }

  const tied = scores.filter((template) => template.score === best.score);
  return tied.find((template) => template.name === branchTemplate)?.name ?? best.name;
}

function scoreTemplate(context: ContentSignature, template: ContentSignature) {
  let score = 0;

  if (context.comment && template.comment) {
    if (context.comment === template.comment) {
      score += 1000;
    } else if (
      context.comment.includes(template.comment) ||
      template.comment.includes(context.comment)
    ) {
      score += 200;
    }
  }

  const contextHeadings = new Set(context.headings);
  for (const heading of template.headings) {
    if (contextHeadings.has(heading)) {
      score += 10;
    }
  }

  if (
    template.headings.length > 0 &&
    template.headings.every((heading) => contextHeadings.has(heading))
  ) {
    score += 50;
  }

  return score;
}

function createContentSignature(content: string): ContentSignature {
  return {
    comment: normalizeBlock(content.match(/<!--([\s\S]*?)-->/)?.[1] ?? null),
    headings: Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((match) =>
      normalizeInline(match[1] ?? ''),
    ),
  };
}

function getFrontmatterTemplate(content: string) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!frontmatter) {
    return null;
  }

  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.trim().match(/^template:\s*['"]?([^'"]+)['"]?$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function normalizeBlock(value: string | null) {
  return value
    ? value
        .replace(/\r\n/g, '\n')
        .trim()
        .replace(/[ \t]+$/gm, '')
    : null;
}

function normalizeInline(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function readTextFile(path: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function countMetaLines(value: string | null | undefined): number {
  if (!value?.trim()) {
    return 0;
  }

  return value.split('\n').filter((line) => line.trim()).length;
}

function getDirectorySize(path: string): number {
  try {
    const stats = lstatSync(path);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    return readdirSync(path).reduce(
      (total, entry) => total + getDirectorySize(join(path, entry)),
      0,
    );
  } catch {
    return 0;
  }
}

function compareContexts(
  left: BranchContextContextSummary,
  right: BranchContextContextSummary,
): number {
  return compareContextSummaryOrder(left, right);
}

function compareArchivedContexts(
  left: BranchContextArchivedContextSummary,
  right: BranchContextArchivedContextSummary,
): number {
  return compareContextSummaryOrder(left, right);
}

function compareContextSummaryOrder(
  left: ContextSummaryOrderSource,
  right: ContextSummaryOrderSource,
): number {
  return (
    compareUpdatedAt(left.updatedAt, right.updatedAt) || left.branch.localeCompare(right.branch)
  );
}

function compareUpdatedAt(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return right.localeCompare(left);
}

function getSymlinkStatus(gitRoot: string): BranchContextSymlinkStatus {
  const path = join(gitRoot, DEFAULT_SYMLINK);

  if (isSymlink(path)) {
    const target = readlinkSync(path);
    return {
      path,
      target,
      state: existsSync(join(gitRoot, target))
        ? BranchContextSymlinkState.Valid
        : BranchContextSymlinkState.Broken,
    };
  }

  if (existsSync(path)) {
    return {
      path,
      target: null,
      state: BranchContextSymlinkState.NotSymlink,
    };
  }

  return {
    path,
    target: null,
    state: BranchContextSymlinkState.Missing,
  };
}

function isSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function getWorkspaceRelativePath(gitRoot: string, path: string) {
  const relPath = relative(gitRoot, path);
  if (
    !relPath ||
    relPath === '..' ||
    relPath.startsWith(`..${pathSeparator}`) ||
    isAbsolute(relPath)
  ) {
    return path;
  }

  return relPath.replaceAll(pathSeparator, '/');
}
