import { listBranches, sanitizeBranchName } from '../core/sync';
import { gitListBranches, gitListRemoteBranches } from '../utils/git';

export type BranchInfo = {
  context: boolean;
  local: boolean;
  remote: boolean;
  sanitized: string;
};

export function collectBranchInfo(gitRoot: string) {
  const contextDirs = new Set(listBranches(gitRoot));
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
    const original = sanitizedToLocal.get(ctx) ?? sanitizedToRemote.get(ctx) ?? ctx;
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
