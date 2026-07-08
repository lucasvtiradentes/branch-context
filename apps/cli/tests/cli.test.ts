import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli';
import { captureConsole, createGitRepo, initBctxWorkspace } from './helpers';

describe('cli dispatch', () => {
  it('uses the dev binary name in help when requested', async () => {
    const capture = captureConsole();

    await withEnv({ BRANCH_CONTEXT_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['--help'])).toBe(0);
    });

    expect(capture.output).toContain('▸ bctxd <command>');
    expect(capture.output).not.toContain('▸ bctx <command>');
  });

  it('generates dev zsh completion with template names', async () => {
    const capture = captureConsole();

    await withEnv({ BRANCH_CONTEXT_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'zsh'])).toBe(0);
    });

    expect(capture.output).toContain('#compdef bctxd');
    expect(capture.output).toContain("'template:Apply template to current branch'");
    expect(capture.output).toContain('_bctxd_templates');
    expect(capture.output).toContain('bctxd status');
    expect(capture.output).toContain('template)\n          _bctxd_templates');
  });

  it('generates bash completion with template names', async () => {
    const capture = captureConsole();

    await withEnv({ BRANCH_CONTEXT_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'bash'])).toBe(0);
    });

    expect(capture.output).toContain('complete -F _bctxd_completion bctxd');
    expect(capture.output).toContain(
      'backup base global init prune status sync template uninstall',
    );
    expect(capture.output).toContain('bctxd status');
    expect(capture.output).toContain('template)');
  });

  it('generates fish completion with template names', async () => {
    const capture = captureConsole();

    await withEnv({ BRANCH_CONTEXT_PROG_NAME: 'bctxd' }, async () => {
      expect(await runCli(['completion', 'fish'])).toBe(0);
    });

    expect(capture.output).toContain('complete -c bctxd -f');
    expect(capture.output).toContain("-a 'template' -d 'Apply template to current branch'");
    expect(capture.output).toContain('__bctxd_templates');
    expect(capture.output).toContain('bctxd status');
    expect(capture.output).toContain("__bctxd_using_command 'template'");
  });

  it('prints help when no command is provided', async () => {
    const capture = captureConsole();

    expect(await runCli([])).toBe(0);
    expect(capture.output).toContain('Git branch context manager');
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
