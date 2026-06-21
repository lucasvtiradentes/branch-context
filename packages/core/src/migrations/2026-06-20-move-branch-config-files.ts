import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { ensureBranchConfigDir } from '../data/branch-config';

export function migrateBranchConfigFile(branchDir: string, fileName: string) {
  const configDir = ensureBranchConfigDir(branchDir);
  const nextPath = join(configDir, fileName);
  const legacyPath = join(branchDir, fileName);

  // Branch-owned state used to live beside user-facing context files. Move it under
  // .config so internal metadata stays separate from task/docs content.
  if (!existsSync(nextPath) && existsSync(legacyPath)) {
    renameSync(legacyPath, nextPath);
  }

  return nextPath;
}
