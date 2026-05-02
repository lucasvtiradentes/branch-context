import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GIT_CONFIG_SCOPE_GLOBAL, type GitConfigScope } from './types';

export function gitConfig(path: string, key: string, value: string): SpawnSyncReturns<string> {
  return spawnSync('git', ['config', key, value], { cwd: path, encoding: 'utf8' });
}

export function gitConfigGet(
  key: string,
  options: { scope?: GitConfigScope; path?: string } = {},
): string | null {
  const args = ['config'];
  if (options.scope === GIT_CONFIG_SCOPE_GLOBAL) {
    args.push('--global');
  }
  args.push(key);

  const result = spawnSync('git', args, {
    cwd: options.path,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  return null;
}

export function gitUserName(path?: string): string | null {
  return gitConfigGet('user.name', { path });
}

export function gitConfigUnset(key: string, scope?: GitConfigScope): boolean {
  const args = ['config', '--unset'];
  if (scope === GIT_CONFIG_SCOPE_GLOBAL) {
    args.splice(1, 0, '--global');
  }
  args.push(key);

  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0;
}

export function gitHooksPath(path: string): string | null {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: path,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export function gitInfoExcludeAdd(path: string, pattern: string): boolean {
  const excludeFile = join(path, '.git', 'info', 'exclude');

  try {
    let existing = '';
    if (existsSync(excludeFile)) {
      existing = readFileSync(excludeFile, 'utf8');
    }

    if (existing.split(/\r?\n/).includes(pattern)) {
      return true;
    }

    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(excludeFile, `${existing}${prefix}${pattern}\n`);
    return true;
  } catch {
    return false;
  }
}
