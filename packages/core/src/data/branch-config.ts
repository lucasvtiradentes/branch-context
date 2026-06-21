import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BRANCH_CONFIG_DIR } from '../constants';

export function getBranchConfigDir(branchDir: string) {
  return join(branchDir, BRANCH_CONFIG_DIR);
}

export function ensureBranchConfigDir(branchDir: string) {
  const configDir = getBranchConfigDir(branchDir);
  mkdirSync(configDir, { recursive: true });
  return configDir;
}
