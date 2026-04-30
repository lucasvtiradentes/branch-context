import { listBranches, sanitizeBranchName } from '../core/sync';
import { green, red } from '../utils/color';
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

export function printTable(allNames: Map<string, BranchInfo>, current: string | null) {
  if (allNames.size === 0) {
    return;
  }

  const groupAll: string[] = [];
  const groupCtxLocal: string[] = [];
  const groupCtxOnly: string[] = [];

  for (const [name, info] of allNames.entries()) {
    if (info.context && info.local && info.remote) {
      groupAll.push(name);
    } else if (info.context && info.local) {
      groupCtxLocal.push(name);
    } else {
      groupCtxOnly.push(name);
    }
  }

  groupAll.sort();
  groupCtxLocal.sort();
  groupCtxOnly.sort();

  const groups = [groupAll, groupCtxLocal, groupCtxOnly].filter((group) => group.length > 0);
  const maxLen = Math.max(...Array.from(allNames.keys()).map((name) => name.length));
  const colWidth = Math.max(maxLen, 6);
  const yes = green('✓');
  const no = red('✗');
  const divider = `${'─'.repeat(colWidth)}  ───────  ─────  ──────`;

  console.log(`    ${'Branch'.padEnd(colWidth)}  Context  Local  Remote`);
  console.log(`    ${divider}`);

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      console.log(`    ${divider}`);
    }
    for (const name of group) {
      const info = allNames.get(name);
      if (!info) {
        continue;
      }
      const marker = current && name === current ? '*' : ' ';
      const ctx = info.context ? yes : no;
      const local = info.local ? yes : no;
      const remote = info.remote ? yes : no;
      console.log(`  ${marker} ${name.padEnd(colWidth)}     ${ctx}       ${local}      ${remote}`);
    }
  });
}
