import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  CONFIG_FILE,
  getMachineConfigPath,
  saveMachineConfig,
  TEMPLATES_DIR,
} from '@branch-context/core';
import { createCommandAdapters, defineCommand } from 'unicommand';

const metadata = defineCommand({
  name: 'global',
  description: 'Configure global storage',
  arguments: [{ synopsis: '<path>', description: 'Global storage path' }],
});

export const globalCommand = createCommandAdapters({
  metadata,
  handler,
});

function handler({ path }: { path?: unknown }) {
  const globalPathArg = typeof path === 'string' ? path : null;
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
