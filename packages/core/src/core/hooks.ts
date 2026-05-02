import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join, relative } from 'node:path';
import { CLI_NAME, GIT_DIR, HOOK_MARKER, HookType } from '../constants';
import { loadHookTemplateResource } from '../resources';
import {
  gitConfigUnset,
  gitCurrentBranch,
  gitHooksPath,
  gitInfoExcludeAdd,
  gitRoot,
} from '../utils/git';
import type { PromptYesNo } from '../utils/prompt';

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
const excludeConfirmed = new Map<string, boolean>();
const appendConfirmed = new Map<string, boolean>();
const hookCallbacks = {
  [HookType.PostCheckout]: 'on-checkout',
  [HookType.PostCommit]: 'on-commit',
} as const satisfies Record<HookType, string>;

export function resetConfirmationState() {
  customHooksConfirmed.clear();
  excludeConfirmed.clear();
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

export function getBranchctxPath() {
  const progName = process.env.BCTX_PROG_NAME ?? CLI_NAME;
  return findOnPath(progName) ?? progName;
}

export function getCallback(hookType: HookType) {
  const branchctxPath = getBranchctxPath();
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

function getStandaloneHookContent(hookType: HookType) {
  return getHookTemplate(hookType)
    .replace('{marker}', HOOK_MARKER)
    .replace('{callback}', getCallback(hookType));
}

const SNIPPET_END_MARKER = '# branch-ctx-end';

function getAppendSnippet(hookType: HookType) {
  const callback = getCallback(hookType);
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

function replaceBctxSnippet(content: string, hookType: HookType) {
  const pattern = new RegExp(
    `${escapeRegex(HOOK_MARKER)}.*?${escapeRegex(SNIPPET_END_MARKER)}`,
    'gs',
  );
  return content.replace(pattern, getAppendSnippet(hookType).trim());
}

export async function installHook(
  gitRootPath: string,
  hookType: HookType = HookType.PostCheckout,
  ask?: PromptYesNo,
): Promise<HookInstallResult> {
  const prompt = ask ?? (await import('../utils/prompt')).promptYesNo;
  const customHooksDir = getCustomHooksDir(gitRootPath);
  let useCustom = false;

  if (customHooksDir) {
    if (!customHooksConfirmed.has(gitRootPath)) {
      const relPath = relative(gitRootPath, customHooksDir);
      console.log(`\nDetected custom hooks directory: ${relPath}`);
      useCustom = await prompt('Install hooks in this directory?');
      customHooksConfirmed.set(gitRootPath, useCustom);

      if (useCustom && !excludeConfirmed.has(gitRootPath)) {
        excludeConfirmed.set(
          gitRootPath,
          await prompt('Exclude hooks from git tracking (.git/info/exclude)?'),
        );
      } else if (!useCustom) {
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
    if (existing.includes(HOOK_MARKER)) {
      const updated = isStandaloneBctxHook(existing)
        ? getStandaloneHookContent(hookType)
        : replaceBctxSnippet(existing, hookType);
      if (updated !== existing) {
        writeFileSync(hookPath, updated);
        chmodSync(hookPath, statSync(hookPath).mode | 0o111);
        return HookInstallResult.Updated;
      }
      return HookInstallResult.AlreadyInstalled;
    }

    const appendKey = `${gitRootPath}:${hookType}`;
    if (!appendConfirmed.has(appendKey)) {
      console.log(`\nExisting ${hookType} hook detected (not managed by bctx)`);
      appendConfirmed.set(appendKey, await prompt('Append bctx callback to existing hook?'));
    }

    if (!appendConfirmed.get(appendKey)) {
      return HookInstallResult.HookExists;
    }

    writeFileSync(hookPath, `${existing}${getAppendSnippet(hookType)}`);
    return HookInstallResult.Appended;
  }

  writeFileSync(hookPath, getStandaloneHookContent(hookType));
  chmodSync(hookPath, statSync(hookPath).mode | 0o111);

  if (useCustom && excludeConfirmed.get(gitRootPath)) {
    gitInfoExcludeAdd(gitRootPath, relative(gitRootPath, hookPath));
  }

  return HookInstallResult.Installed;
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
    if (existsSync(hookPath)) {
      return HookUninstallResult.NotManaged;
    }
  }

  return HookUninstallResult.NotInstalled;
}

export function getCurrentBranch(path?: string) {
  return gitCurrentBranch(path ?? process.cwd());
}

export function unsetGlobalHooksPath() {
  return gitConfigUnset('core.hooksPath', 'global');
}

export function hookBasename(hookPath: string) {
  return basename(hookPath);
}
