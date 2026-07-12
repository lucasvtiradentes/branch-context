import { listBranches, sanitizeBranchName } from '../core/sync';
import { getBranchMeta } from '../data/meta';
import { gitListBranches, gitListRemoteBranches } from '../git';

const DETACHED_HEAD_BRANCH_NAME = 'HEAD';
const PROTECTED_BRANCH_NAMES = new Set(['main', 'master']);

export type BranchInfo = {
  context: boolean;
  local: boolean;
  remote: boolean;
  sanitized: string;
};

export function isProtectedBranchName(branchName: string) {
  return PROTECTED_BRANCH_NAMES.has(branchName);
}

export function collectBranchInfo(gitRoot: string) {
  const contextDirs = new Set(
    listBranches(gitRoot).filter((branch) => branch !== DETACHED_HEAD_BRANCH_NAME),
  );
  const localBranches = gitListBranches(gitRoot);
  const remoteBranches = new Set(gitListRemoteBranches(gitRoot));

  const localToSanitized = new Map(
    localBranches.map((branch) => [branch, sanitizeBranchName(branch)]),
  );
  const sanitizedToLocal = new Map(
    Array.from(localToSanitized.entries()).map(([key, value]) => [value, key]),
  );
  const sanitizedToRemote = new Map(
    Array.from(remoteBranches).map((branch) => [sanitizeBranchName(branch), branch]),
  );

  const allNames = new Map<string, BranchInfo>();

  for (const ctx of contextDirs) {
    const original =
      sanitizedToLocal.get(ctx) ??
      sanitizedToRemote.get(ctx) ??
      getBranchMeta(gitRoot, ctx)?.branch ??
      ctx;
    allNames.set(original, {
      context: true,
      local: Array.from(localToSanitized.values()).includes(ctx),
      remote: remoteBranches.has(original),
      sanitized: ctx,
    });
  }

  for (const branch of localBranches) {
    if (!allNames.has(branch)) {
      const sanitized = localToSanitized.get(branch) ?? sanitizeBranchName(branch);
      if (!contextDirs.has(sanitized)) {
        allNames.set(branch, {
          context: false,
          local: true,
          remote: remoteBranches.has(branch),
          sanitized,
        });
      }
    }
  }

  return allNames;
}
