import { describe, expect, it } from 'vitest';
import { runCli } from '../src/index';
import { captureConsole, createGitRepo, initBctxWorkspace } from './helpers';

describe('agents command', () => {
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
