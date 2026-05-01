import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_BRANCH_FILE, CONFIG_DIR, CONFIG_FILE, DEFAULT_BASE_BRANCH } from '../constants';
import { gitRefExists } from '../utils/git';

const FALLBACK_BASE_BRANCHES = ['main', 'master', 'origin/main', 'origin/master'];

function getConfigDefaultBaseBranch(workspace: string) {
  const configPath = join(workspace, CONFIG_DIR, CONFIG_FILE);
  if (existsSync(configPath)) {
    try {
      const data = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      return typeof data.default_base_branch === 'string'
        ? data.default_base_branch
        : DEFAULT_BASE_BRANCH;
    } catch {}
  }
  return DEFAULT_BASE_BRANCH;
}

export function getBaseBranch(workspace: string, branchDir: string) {
  const filePath = join(branchDir, BASE_BRANCH_FILE);
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return resolveDefaultBaseBranch(workspace, getConfigDefaultBaseBranch(workspace));
}

export function saveBaseBranch(branchDir: string, base: string) {
  writeFileSync(join(branchDir, BASE_BRANCH_FILE), `${base}\n`);
}

function resolveDefaultBaseBranch(workspace: string, baseBranch: string) {
  if (gitRefExists(workspace, baseBranch)) {
    return baseBranch;
  }

  for (const candidate of getFallbackBaseBranches(baseBranch)) {
    if (gitRefExists(workspace, candidate)) {
      return candidate;
    }
  }

  return baseBranch;
}

function getFallbackBaseBranches(baseBranch: string) {
  const candidates = baseBranch.startsWith('origin/')
    ? [baseBranch.slice('origin/'.length)]
    : [`origin/${baseBranch}`];

  return Array.from(new Set([...candidates, ...FALLBACK_BASE_BRANCHES])).filter(
    (candidate) => candidate && candidate !== baseBranch,
  );
}
