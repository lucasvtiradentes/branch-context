import type { BranchInfo } from '@branch-context/core';
import { green, red } from '../ui/color';

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
