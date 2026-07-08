import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  sep as pathSeparator,
  relative,
} from 'node:path';
import { CLI_NAME, CLI_PROGRAM_NAME_ENV, GIT_DIR, HOOK_MARKER, HookType } from '../constants';
import { gitCurrentBranch, gitHooksPath, gitInfoExcludeAdd, gitRoot } from '../git';
import { loadHookTemplateResource } from '../resources';

export type PromptYesNo = (question: string) => Promise<boolean>;
export type InstallHookOptions = {
  commandName?: string | null;
};

export enum HookInstallResult {
  Installed = 'installed',
  AlreadyInstalled = 'already_installed',
  HookExists = 'hook_exists',
  Appended = 'appended',
  Updated = 'updated',
}

export enum HookUninstallResult {
  Uninstalled = 'uninstalled',
  NotInstalled = 'not_installed',
  NotManaged = 'not_managed',
}

const customHooksConfirmed = new Map<string, boolean>();
const customHooksExcludeConfirmed = new Map<string, boolean>();
const appendConfirmed = new Map<string, boolean>();
const hookCallbacks = {
  [HookType.PostCheckout]: 'on-checkout',
  [HookType.PostCommit]: 'on-commit',
} as const satisfies Record<HookType, string>;
const noPrompt: PromptYesNo = async () => false;

export function resetConfirmationState() {
  customHooksConfirmed.clear();
  customHooksExcludeConfirmed.clear();
  appendConfirmed.clear();
}

function findOnPath(name: string) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getBranchctxPath(commandName?: string | null) {
  const progName = commandName ?? process.env[CLI_PROGRAM_NAME_ENV] ?? CLI_NAME;
  return findOnPath(progName) ?? progName;
}

export function getCallback(hookType: HookType, options: InstallHookOptions = {}) {
  const branchctxPath = getBranchctxPath(options.commandName);
  return `"${branchctxPath}" ${hookCallbacks[hookType]}`;
}

export function getGitRoot(path?: string) {
  return gitRoot(path ?? process.cwd());
}

export function getCustomHooksDir(gitRootPath: string) {
  const customPath = gitHooksPath(gitRootPath);
  if (!customPath) {
    return null;
  }
  return isAbsolute(customPath) ? customPath : join(gitRootPath, customPath);
}

function isHuskyDir(hooksDir: string) {
  return existsSync(join(hooksDir, 'h'));
}

function getHuskyUserHooksDir(hooksDir: string) {
  if (!isHuskyDir(hooksDir)) {
    return null;
  }
  return dirname(hooksDir);
}

export function getHookPath(
  gitRootPath: string,
  hookType: HookType = HookType.PostCheckout,
  useCustom = false,
) {
  if (useCustom) {
    const customPath = gitHooksPath(gitRootPath);
    if (customPath) {
      const hooksDir = isAbsolute(customPath) ? customPath : join(gitRootPath, customPath);
      const huskyDir = getHuskyUserHooksDir(hooksDir);
      if (huskyDir) {
        return join(huskyDir, hookType);
      }
      return join(hooksDir, hookType);
    }
  }
  return join(gitRootPath, GIT_DIR, 'hooks', hookType);
}

function getAllHookPaths(gitRootPath: string, hookType: HookType) {
  const paths = [getHookPath(gitRootPath, hookType, false)];
  const customHooksDir = getCustomHooksDir(gitRootPath);
  if (customHooksDir) {
    paths.push(join(customHooksDir, hookType));
    const huskyDir = getHuskyUserHooksDir(customHooksDir);
    if (huskyDir) {
      paths.push(join(huskyDir, hookType));
    }
  }
  return paths;
}

export function isHookInstalled(gitRootPath: string, hookType: HookType = HookType.PostCheckout) {
  for (const hookPath of getAllHookPaths(gitRootPath, hookType)) {
    if (existsSync(hookPath) && readFileSync(hookPath, 'utf8').includes(HOOK_MARKER)) {
      return true;
    }
  }
  return false;
}

function getHookTemplate(hookType: HookType) {
  return loadHookTemplateResource(hookType);
}

function getStandaloneHookContent(hookType: HookType, options: InstallHookOptions = {}) {
  return getHookTemplate(hookType)
    .replace('{marker}', HOOK_MARKER)
    .replace('{callback}', getCallback(hookType, options));
}

const SNIPPET_END_MARKER = '# branch-ctx-end';

function getAppendSnippet(hookType: HookType, options: InstallHookOptions = {}) {
  const callback = getCallback(hookType, options);
  if (hookType === HookType.PostCheckout) {
    return `
${HOOK_MARKER}
OLD_BRANCH=$(git rev-parse --abbrev-ref @{-1} 2>/dev/null || echo "unknown")
NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
${callback} "$OLD_BRANCH" "$NEW_BRANCH"
${SNIPPET_END_MARKER}
`;
  }
  return `
${HOOK_MARKER}
${callback}
${SNIPPET_END_MARKER}
`;
}

function replaceBctxSnippet(content: string, hookType: HookType, options: InstallHookOptions = {}) {
  const pattern = new RegExp(
    `${escapeRegex(HOOK_MARKER)}.*?${escapeRegex(SNIPPET_END_MARKER)}`,
    'gs',
  );
  return content.replace(pattern, getAppendSnippet(hookType, options).trim());
}

export async function installHook(
  gitRootPath: string,
  hookType: HookType = HookType.PostCheckout,
  ask?: PromptYesNo,
  options: InstallHookOptions = {},
): Promise<HookInstallResult> {
  const prompt = ask ?? noPrompt;
  const customHooksDir = getCustomHooksDir(gitRootPath);
  const managedHookPath = getExistingManagedHookPath(gitRootPath, hookType);
  if (managedHookPath) {
    const existing = readFileSync(managedHookPath, 'utf8');
    const updated = isStandaloneBctxHook(existing)
      ? getStandaloneHookContent(hookType, options)
      : replaceBctxSnippet(existing, hookType, options);
    if (updated !== existing) {
      writeFileSync(managedHookPath, updated);
      chmodSync(managedHookPath, statSync(managedHookPath).mode | 0o111);
      await maybeExcludeHookFromGitTracking(gitRootPath, managedHookPath, prompt);
      return HookInstallResult.Updated;
    }
    await maybeExcludeHookFromGitTracking(gitRootPath, managedHookPath, prompt);
    return HookInstallResult.AlreadyInstalled;
  }

  let useCustom = false;

  if (customHooksDir) {
    if (!customHooksConfirmed.has(gitRootPath)) {
      const relPath = relative(gitRootPath, customHooksDir);
      console.log(`\nDetected custom hooks directory: ${relPath}`);
      useCustom = await prompt(`Install hooks in custom hooks directory '${relPath}'?`);
      customHooksConfirmed.set(gitRootPath, useCustom);

      if (!useCustom) {
        console.log(
          `warning: hooks in .git/hooks/ won't run while core.hooksPath is set to '${relPath}'`,
        );
      }
    } else {
      useCustom = customHooksConfirmed.get(gitRootPath) ?? false;
    }
  }

  const hookPath = getHookPath(gitRootPath, hookType, useCustom);
  mkdirSync(dirname(hookPath), { recursive: true });

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    const appendKey = `${gitRootPath}:${hookType}`;
    if (!appendConfirmed.has(appendKey)) {
      console.log(`\nExisting ${hookType} hook detected (not managed by bctx)`);
      appendConfirmed.set(appendKey, await prompt('Append bctx callback to existing hook?'));
    }

    if (!appendConfirmed.get(appendKey)) {
      return HookInstallResult.HookExists;
    }

    writeFileSync(hookPath, `${existing}${getAppendSnippet(hookType, options)}`);
    await maybeExcludeHookFromGitTracking(gitRootPath, hookPath, prompt);
    return HookInstallResult.Appended;
  }

  writeFileSync(hookPath, getStandaloneHookContent(hookType, options));
  chmodSync(hookPath, statSync(hookPath).mode | 0o111);
  await maybeExcludeHookFromGitTracking(gitRootPath, hookPath, prompt);

  return HookInstallResult.Installed;
}

async function maybeExcludeHookFromGitTracking(
  gitRootPath: string,
  hookPath: string,
  prompt: PromptYesNo,
) {
  const pattern = getLocalHookExcludePattern(gitRootPath, hookPath);
  if (!pattern) {
    return;
  }

  if (!customHooksExcludeConfirmed.has(gitRootPath)) {
    customHooksExcludeConfirmed.set(
      gitRootPath,
      await prompt('Exclude bctx hook files from local git tracking?'),
    );
  }

  if (customHooksExcludeConfirmed.get(gitRootPath)) {
    gitInfoExcludeAdd(gitRootPath, pattern);
  }
}

function getLocalHookExcludePattern(gitRootPath: string, hookPath: string) {
  const relPath = relative(gitRootPath, hookPath).replaceAll(pathSeparator, '/');
  if (
    !relPath ||
    relPath === '..' ||
    relPath.startsWith('../') ||
    relPath.startsWith(`${GIT_DIR}/`)
  ) {
    return null;
  }
  return relPath;
}

function getExistingManagedHookPath(gitRootPath: string, hookType: HookType) {
  const paths = new Set<string>();
  if (getCustomHooksDir(gitRootPath)) {
    paths.add(getHookPath(gitRootPath, hookType, true));
  }
  paths.add(getHookPath(gitRootPath, hookType, false));

  for (const hookPath of paths) {
    if (existsSync(hookPath) && readFileSync(hookPath, 'utf8').includes(HOOK_MARKER)) {
      return hookPath;
    }
  }

  return null;
}

function removeBctxSnippet(content: string) {
  const pattern = new RegExp(
    `\\n?${escapeRegex(HOOK_MARKER)}.*?${escapeRegex(SNIPPET_END_MARKER)}\\n?`,
    'gs',
  );
  return content.replace(pattern, '');
}

function isStandaloneBctxHook(content: string) {
  if (content.includes(SNIPPET_END_MARKER)) {
    const remaining = removeBctxSnippet(content).trim();
    if (!remaining) {
      return true;
    }
    const lines = remaining
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#!'));
    return lines.length === 0;
  }
  const lines = content.trim().split('\n');
  return lines.length >= 2 && (lines[1] ?? '').trim() === HOOK_MARKER;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function uninstallHook(
  gitRootPath: string,
  hookType: HookType = HookType.PostCheckout,
): HookUninstallResult {
  for (const hookPath of getAllHookPaths(gitRootPath, hookType)) {
    if (!existsSync(hookPath)) {
      continue;
    }

    const content = readFileSync(hookPath, 'utf8');
    if (!content.includes(HOOK_MARKER)) {
      continue;
    }

    if (isStandaloneBctxHook(content)) {
      rmSync(hookPath);
    } else if (content.includes(SNIPPET_END_MARKER)) {
      const fileMode = statSync(hookPath).mode;
      writeFileSync(hookPath, removeBctxSnippet(content));
      chmodSync(hookPath, fileMode);
    } else {
      rmSync(hookPath);
    }

    return HookUninstallResult.Uninstalled;
  }

  for (const hookPath of getAllHookPaths(gitRootPath, hookType)) {
    if (existsSync(hookPath) && !isHuskyShimHook(gitRootPath, hookPath)) {
      return HookUninstallResult.NotManaged;
    }
  }

  return HookUninstallResult.NotInstalled;
}

function isHuskyShimHook(gitRootPath: string, hookPath: string) {
  const customHooksDir = getCustomHooksDir(gitRootPath);
  if (!customHooksDir || !isHuskyDir(customHooksDir)) {
    return false;
  }

  return hookPath.startsWith(`${customHooksDir}${pathSeparator}`);
}

export function getCurrentBranch(path?: string) {
  return gitCurrentBranch(path ?? process.cwd());
}

export function hookBasename(hookPath: string) {
  return basename(hookPath);
}
