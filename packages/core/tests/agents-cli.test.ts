import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmdAgents, formatCodexHookOutput, runCli } from '../src/index';
import { captureConsole, createTempDir } from './helpers';

describe('agents command', () => {
  it('prints help for invalid usage', async () => {
    const capture = captureConsole();

    expect(await cmdAgents([])).toBe(1);
    expect(capture.output).toContain('bctx agents status');
  });

  it('installs codex hook through cli dispatch', async () => {
    const root = createTempDir();
    process.env.BCTX_CODEX_HOOKS_PATH = join(root, 'hooks.json');
    process.env.BCTX_CODEX_CONFIG_PATH = join(root, 'config.toml');

    try {
      expect(await runCli(['agents', 'install', 'codex'])).toBe(0);
      expect(existsSync(process.env.BCTX_CODEX_HOOKS_PATH)).toBe(true);
      expect(existsSync(process.env.BCTX_CODEX_CONFIG_PATH)).toBe(true);
    } finally {
      delete process.env.BCTX_CODEX_HOOKS_PATH;
      delete process.env.BCTX_CODEX_CONFIG_PATH;
    }
  });

  it('formats codex hook output', () => {
    const output = formatCodexHookOutput({
      ok: true,
      captured: false,
      reason: 'not_initialized',
      agentsFilePath: null,
      metadata: {
        version: 1,
        provider: 'codex',
        repoRoot: '/repo',
        branch: 'main',
        branchKey: 'main',
        sessionId: 'codex-1',
      },
    });

    expect(JSON.parse(output).hookSpecificOutput.additionalContext).toContain(
      'BCTX_SESSION_METADATA',
    );
  });
});
