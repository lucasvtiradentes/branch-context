import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_BRANCH_FILE } from '../constants';
import { ensureBranchConfigDir, getBranchConfigDir } from './branch-config';
import { Config } from './config';

function getConfigDefaultBaseBranch(workspace: string) {
  return Config.load(workspace).defaultBaseBranch;
}

export function getBaseBranch(workspace: string, branchDir: string) {
  const filePath = join(getBranchConfigDir(branchDir), BASE_BRANCH_FILE);
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf8').trim();
  }

  return getConfigDefaultBaseBranch(workspace);
}

export function saveBaseBranch(branchDir: string, base: string) {
  writeFileSync(join(ensureBranchConfigDir(branchDir), BASE_BRANCH_FILE), `${base}\n`);
}
