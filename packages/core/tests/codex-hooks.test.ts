import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CODEX_HOOK_STATUS,
  getCodexHookStatus,
  installCodexMetadataHook,
  uninstallCodexMetadataHook,
  upsertTomlBool,
} from '../src/index';
import { createTempDir } from './helpers';

function paths() {
  const root = createTempDir();
  return {
    hooksPath: join(root, '.codex', 'hooks.json'),
    configPath: join(root, '.codex', 'config.toml'),
  };
}

describe('codex metadata hook', () => {
  it('installs hook and enables config', () => {
    const options = paths();
    const status = installCodexMetadataHook({ ...options, command: 'bctx agents codex-hook' });

    expect(status.installed).toBe(true);
    expect(readFileSync(options.hooksPath, 'utf8')).toContain(CODEX_HOOK_STATUS);
    expect(readFileSync(options.configPath, 'utf8')).toContain('codex_hooks = true');
  });

  it('preserves unrelated hooks', () => {
    const options = paths();
    mkdirSync(dirname(options.hooksPath), { recursive: true });
    writeFileSync(
      options.hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'printf done' }] }],
        },
      }),
    );

    installCodexMetadataHook({ ...options, command: 'bctx agents codex-hook' });
    const data = JSON.parse(readFileSync(options.hooksPath, 'utf8'));

    expect(data.hooks.Stop[0].hooks[0].command).toBe('printf done');
    expect(data.hooks.SessionStart[0].hooks[0].statusMessage).toBe(CODEX_HOOK_STATUS);
  });

  it('is idempotent', () => {
    const options = paths();
    installCodexMetadataHook({ ...options, command: 'bctx agents codex-hook' });
    installCodexMetadataHook({ ...options, command: 'bctx agents codex-hook' });
    const data = JSON.parse(readFileSync(options.hooksPath, 'utf8'));

    expect(data.hooks.SessionStart).toHaveLength(1);
  });

  it('uninstalls only the managed hook', () => {
    const options = paths();
    mkdirSync(dirname(options.hooksPath), { recursive: true });
    writeFileSync(
      options.hooksPath,
      JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [{ type: 'command', command: 'printf keep' }] },
            {
              hooks: [
                {
                  type: 'command',
                  command: 'bctx agents codex-hook',
                  statusMessage: CODEX_HOOK_STATUS,
                },
              ],
            },
          ],
        },
      }),
    );

    const status = uninstallCodexMetadataHook(options);
    const data = JSON.parse(readFileSync(options.hooksPath, 'utf8'));

    expect(status.installed).toBe(false);
    expect(data.hooks.SessionStart).toHaveLength(1);
    expect(data.hooks.SessionStart[0].hooks[0].command).toBe('printf keep');
  });

  it('updates stale managed hook command', () => {
    const options = paths();
    installCodexMetadataHook({ ...options, command: 'old bctx agents codex-hook' });
    installCodexMetadataHook({ ...options, command: 'new bctx agents codex-hook' });
    const data = JSON.parse(readFileSync(options.hooksPath, 'utf8'));

    expect(data.hooks.SessionStart).toHaveLength(1);
    expect(data.hooks.SessionStart[0].hooks[0].command).toBe('new bctx agents codex-hook');
  });

  it('reports missing hook status', () => {
    const options = paths();
    expect(getCodexHookStatus(options).installed).toBe(false);
  });

  it('upserts toml booleans', () => {
    const file = join(createTempDir(), 'config.toml');
    writeFileSync(file, '[features]\ncodex_hooks = false\n\n[tui]\nstatus_line = []\n');
    upsertTomlBool(file, 'features', 'codex_hooks', true);

    const content = readFileSync(file, 'utf8');
    expect(content).toContain('codex_hooks = true');
    expect(content).toContain('[tui]');
  });

  it('creates missing toml file', () => {
    const file = join(createTempDir(), 'missing', 'config.toml');
    upsertTomlBool(file, 'features', 'codex_hooks', true);

    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('[features]');
  });
});
