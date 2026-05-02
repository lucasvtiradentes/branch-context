import { describe, expect, it } from 'vitest';
import { runCli } from '../src/index';
import { captureConsole, createGitRepo, initBctxWorkspace } from './helpers';

describe('agents command', () => {
  it('uses the dev binary name in help when requested', async () => {
    const capture = captureConsole();

    await withEnv({ BCTX_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['--help'])).toBe(0);
    });

    expect(capture.output).toContain('bctxd init');
    expect(capture.output).toContain('bctxd agents status');
    expect(capture.output).not.toContain('bctx init');
  });

  it('completes dev agents subcommands independently', async () => {
    const capture = captureConsole();

    await withEnv(
      {
        BCTX_PROG_NAME: 'bctxd',
        COMP_CWORD: '2',
        COMP_LINE: 'bctxd agents ',
        COMP_POINT: String('bctxd agents '.length),
      },
      async () => {
        expect(await runCli(['completion', '--', 'bctxd', 'agents'])).toBe(0);
      },
    );

    expect(capture.output).toContain('status');
    expect(capture.output).toContain('sync');
  });

  it('prints help when no command is provided', async () => {
    const capture = captureConsole();

    expect(await runCli([])).toBe(0);
    expect(capture.output).toContain('Git branch context manager');
    expect(capture.output).toContain('agents status');
  });

  it('prints help for invalid usage', async () => {
    const capture = captureConsole();

    expect(await runCli(['agents'])).toBe(1);
    expect(capture.output).toContain('Unknown command');
  });

  it('shows agent status through cli dispatch', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();

    expect(await runCli(['agents', 'status'])).toBe(0);
    expect(capture.output).toContain('Branch:');
    expect(capture.output).toContain('Providers:    none');
  });

  it('syncs agents through cli dispatch', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    process.chdir(repo);
    const capture = captureConsole();

    expect(await runCli(['agents', 'sync'])).toBe(0);
    expect(capture.output).toContain('Synced agents: 0');
  });
});

async function withEnv(env: Record<string, string>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
