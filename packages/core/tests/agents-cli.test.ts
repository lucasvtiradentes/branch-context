import { describe, expect, it } from 'vitest';
import { cmdAgents, runCli } from '../src/index';
import { captureConsole, createGitRepo, initBctxWorkspace } from './helpers';

describe('agents command', () => {
  it('prints help for invalid usage', async () => {
    const capture = captureConsole();

    expect(await cmdAgents([])).toBe(1);
    expect(capture.output).toContain('bctx agents status');
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
