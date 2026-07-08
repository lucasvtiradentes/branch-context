import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  CONFIG_FILE,
  getMachineConfigPath,
  saveMachineConfig,
  TEMPLATES_DIR,
} from '@branch-context/core';
import type { Program } from '@caporal/core';

export function registerGlobalCommand(program: Program) {
  program
    .command('global', 'Configure global storage')
    .argument('<path>', 'Global storage path')
    .action(({ args }) => cmdGlobal(typeof args.path === 'string' ? args.path : null));
}

function cmdGlobal(globalPathArg: string | null) {
  const globalPath = expandHome(globalPathArg?.trim() ?? '');
  if (!globalPath) {
    console.log('error: global path is required');
    return 1;
  }

  saveMachineConfig({ global_path: globalPath });
  mkdirSync(join(globalPath, 'repos'), { recursive: true });
  mkdirSync(join(globalPath, TEMPLATES_DIR), { recursive: true });
  mkdirSync(globalPath, { recursive: true });

  const globalConfigPath = join(globalPath, CONFIG_FILE);
  if (!existsSync(globalConfigPath)) {
    writeFileSync(
      globalConfigPath,
      `${JSON.stringify({ default_base_branch: 'origin/main', sound: true, commit_description: false }, null, 2)}\n`,
    );
  }

  console.log(`Machine config: ${getMachineConfigPath()}`);
  console.log(`Global path:    ${globalPath}`);
  console.log(`Global config:  ${join(globalPath, CONFIG_FILE)}`);
  return 0;
}

function expandHome(path: string) {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}
