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
import { promptText } from '../ui/prompt';

export function registerSetupCommand(program: Program) {
  program
    .command('setup', 'Configure shared storage')
    .option('--shared-path <path>', 'Shared storage path')
    .action(({ options }) =>
      cmdSetup(typeof options.sharedPath === 'string' ? options.sharedPath : null),
    );
}

async function cmdSetup(sharedPathArg: string | null) {
  const sharedPath = expandHome(
    sharedPathArg?.trim() || (await promptText('Shared path', '~/branches')).trim(),
  );
  if (!sharedPath) {
    console.log('error: shared path is required');
    return 1;
  }

  saveMachineConfig({ shared_path: sharedPath });
  mkdirSync(join(sharedPath, 'repos'), { recursive: true });
  mkdirSync(join(sharedPath, TEMPLATES_DIR), { recursive: true });
  mkdirSync(sharedPath, { recursive: true });

  const sharedConfigPath = join(sharedPath, CONFIG_FILE);
  if (!existsSync(sharedConfigPath)) {
    writeFileSync(
      sharedConfigPath,
      `${JSON.stringify({ default_base_branch: 'origin/main', sound: true, commit_description: false }, null, 2)}\n`,
    );
  }

  console.log(`Machine config: ${getMachineConfigPath()}`);
  console.log(`Shared path:    ${sharedPath}`);
  console.log(`Shared config:  ${join(sharedPath, CONFIG_FILE)}`);
  return 0;
}

function expandHome(path: string) {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}
