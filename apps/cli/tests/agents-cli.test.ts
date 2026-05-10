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

  it('generates dev zsh completion with agents subcommands', async () => {
    const capture = captureConsole();

    await withEnv({ BCTX_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'zsh'])).toBe(0);
    });

    expect(capture.output).toContain('#compdef bctxd');
    expect(capture.output).toContain("'status:Show agent integration status'");
    expect(capture.output).toContain("'sync:Sync agent sessions'");
    expect(capture.output).toContain("'apply:Apply template to current branch'");
    expect(capture.output).toContain("'source:Show or set the templates folder'");
    expect(capture.output).toContain('_bctxd_templates');
    expect(capture.output).toContain('bctxd template source');
    expect(capture.output).toContain("'template apply')\n          _bctxd_templates");
  });

  it('generates bash completion with agents subcommands', async () => {
    const capture = captureConsole();

    await withEnv({ BCTX_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'bash'])).toBe(0);
    });

    expect(capture.output).toContain('complete -F _bctxd_completion bctxd');
    expect(capture.output).toContain('base init uninstall sync status agents prune template');
    expect(capture.output).toContain('status sync');
    expect(capture.output).toContain('apply source');
    expect(capture.output).toContain('bctxd template source');
  });

  it('generates fish completion with agents subcommands', async () => {
    const capture = captureConsole();

    await withEnv({ BCTX_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'fish'])).toBe(0);
    });

    expect(capture.output).toContain('complete -c bctxd -f');
    expect(capture.output).toContain("-a 'agents' -d 'Agent integration commands'");
    expect(capture.output).toContain("-a 'sync' -d 'Sync agent sessions'");
    expect(capture.output).toContain("-a 'apply' -d 'Apply template to current branch'");
    expect(capture.output).toContain("-a 'source' -d 'Show or set the templates folder'");
    expect(capture.output).toContain('__bctxd_templates');
    expect(capture.output).toContain('bctxd template source');
    expect(capture.output).toContain("__bctxd_using_subcommand 'template' 'apply'");
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

  it('uses original cwd from dev shim', async () => {
    const repo = createGitRepo();
    initBctxWorkspace(repo);
    const capture = captureConsole();
    const previous = process.env.BCTX_ORIGINAL_CWD;
    process.env.BCTX_ORIGINAL_CWD = repo;
    try {
      expect(await runCli(['status'])).toBe(1);
    } finally {
      if (previous === undefined) {
        delete process.env.BCTX_ORIGINAL_CWD;
      } else {
        process.env.BCTX_ORIGINAL_CWD = previous;
      }
    }

    expect(capture.output).toContain('Branch:      main');
    expect(capture.output).not.toContain('not initialized');
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
