import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { gitConfig } from '../src/git';
import {
  getHookPath,
  HOOK_MARKER,
  HOOK_POST_CHECKOUT,
  HOOK_POST_COMMIT,
  HookInstallResult,
  HookUninstallResult,
  installHook,
  isHookInstalled,
  resetConfirmationState,
  uninstallHook,
} from '../src/index';
import { createGitRepo, createTempDir } from './helpers';

const originalPath = process.env.PATH;

beforeEach(() => {
  process.env.PATH = originalPath;
  addFakeCommandToPath('bctx');
});

function addFakeCommandToPath(commandName: string) {
  const binDir = createTempDir();
  const commandPath = join(binDir, commandName);
  writeFileSync(commandPath, '#!/bin/sh\n');
  chmodSync(commandPath, 0o755);
  process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
}

describe('post-checkout hook', () => {
  it('installs hook', async () => {
    const repo = createGitRepo();
    resetConfirmationState();
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.Installed);
    const content = readFileSync(getHookPath(repo, HOOK_POST_CHECKOUT), 'utf8');
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain('on-checkout');
  });

  it('installs hook with custom command name', async () => {
    const repo = createGitRepo();
    addFakeCommandToPath('custom-bctxd-test');
    expect(
      await installHook(repo, HOOK_POST_CHECKOUT, undefined, { commandName: 'custom-bctxd-test' }),
    ).toBe(HookInstallResult.Installed);
    const content = readFileSync(getHookPath(repo, HOOK_POST_CHECKOUT), 'utf8');
    expect(content).toContain('/custom-bctxd-test" on-checkout');
  });

  it('does not install hook when command is missing', async () => {
    const repo = createGitRepo();
    expect(
      await installHook(repo, HOOK_POST_CHECKOUT, undefined, { commandName: 'missing-bctx' }),
    ).toBe(HookInstallResult.CommandNotFound);
    expect(existsSync(getHookPath(repo, HOOK_POST_CHECKOUT))).toBe(false);
  });

  it('detects already installed hook', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_CHECKOUT);
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.AlreadyInstalled);
  });

  it('updates managed hook callback when stale', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_CHECKOUT);
    writeFileSync(
      hookPath,
      '#!/bin/bash\n# branch-ctx-managed\n\n"/missing/bctx" on-checkout "$@"\n',
    );
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.Updated);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).not.toContain('/missing/bctx');
    expect(content).toContain('on-checkout');
  });

  it('updates managed husky hook before installing inactive git hook', async () => {
    const repo = createGitRepo();
    addFakeCommandToPath('custom-bctxd-test');
    expect(gitConfig(repo, 'core.hooksPath', '.husky/_').status).toBe(0);
    mkdirSync(join(repo, '.husky', '_'), { recursive: true });
    writeFileSync(join(repo, '.husky', '_', 'h'), '');
    mkdirSync(join(repo, '.husky'), { recursive: true });
    const hookPath = join(repo, '.husky', HOOK_POST_CHECKOUT);
    writeFileSync(
      hookPath,
      '#!/bin/bash\n# branch-ctx-managed\n\n"/missing/bctx" on-checkout "$@"\n',
    );

    expect(
      await installHook(repo, HOOK_POST_CHECKOUT, undefined, { commandName: 'custom-bctxd-test' }),
    ).toBe(HookInstallResult.Updated);

    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('/custom-bctxd-test" on-checkout');
    expect(existsSync(join(repo, '.git', 'hooks', HOOK_POST_CHECKOUT))).toBe(false);
  });

  it('excludes custom hook files from local git tracking when confirmed', async () => {
    const repo = createGitRepo();
    resetConfirmationState();
    expect(gitConfig(repo, 'core.hooksPath', '.husky/_').status).toBe(0);
    mkdirSync(join(repo, '.husky', '_'), { recursive: true });
    writeFileSync(join(repo, '.husky', '_', 'h'), '');
    const answers = [true, true];
    const ask = async () => answers.shift() ?? false;

    expect(await installHook(repo, HOOK_POST_CHECKOUT, ask)).toBe(HookInstallResult.Installed);
    expect(await installHook(repo, HOOK_POST_COMMIT, ask)).toBe(HookInstallResult.Installed);

    const exclude = readFileSync(join(repo, '.git', 'info', 'exclude'), 'utf8');
    expect(exclude).toContain(`.husky/${HOOK_POST_CHECKOUT}`);
    expect(exclude).toContain(`.husky/${HOOK_POST_COMMIT}`);
  });

  it('does not append unmanaged hook when declined', async () => {
    const repo = createGitRepo();
    writeFileSync(getHookPath(repo, HOOK_POST_CHECKOUT), "#!/bin/bash\necho 'existing hook'");
    expect(await installHook(repo, HOOK_POST_CHECKOUT, async () => false)).toBe(
      HookInstallResult.HookExists,
    );
  });

  it('appends unmanaged hook when confirmed', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_CHECKOUT);
    writeFileSync(hookPath, "#!/bin/bash\necho 'existing hook'");
    expect(await installHook(repo, HOOK_POST_CHECKOUT, async () => true)).toBe(
      HookInstallResult.Appended,
    );
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain('on-checkout');
  });

  it('updates appended managed snippet when stale', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_CHECKOUT);
    writeFileSync(
      hookPath,
      '#!/bin/bash\necho \'existing hook\'\n# branch-ctx-managed\n"/missing/bctx" on-checkout\n# branch-ctx-end\n',
    );
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.Updated);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).not.toContain('/missing/bctx');
    expect(content).toContain('# branch-ctx-end');
  });

  it('checks if hook is installed', async () => {
    const repo = createGitRepo();
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(false);
    await installHook(repo, HOOK_POST_CHECKOUT);
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(true);
  });

  it('uninstalls hook', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_CHECKOUT);
    expect(uninstallHook(repo, HOOK_POST_CHECKOUT)).toBe(HookUninstallResult.Uninstalled);
    expect(existsSync(getHookPath(repo, HOOK_POST_CHECKOUT))).toBe(false);
  });

  it('returns not_installed when hook is missing', () => {
    expect(uninstallHook(createGitRepo(), HOOK_POST_CHECKOUT)).toBe(
      HookUninstallResult.NotInstalled,
    );
  });

  it('ignores husky shim hook when user hook is missing', () => {
    const repo = createGitRepo();
    expect(gitConfig(repo, 'core.hooksPath', '.husky/_').status).toBe(0);
    mkdirSync(join(repo, '.husky', '_'), { recursive: true });
    writeFileSync(join(repo, '.husky', '_', 'h'), '');
    writeFileSync(
      join(repo, '.husky', '_', HOOK_POST_CHECKOUT),
      '#!/usr/bin/env sh\n. "$(dirname "$0")/h"',
    );

    expect(uninstallHook(repo, HOOK_POST_CHECKOUT)).toBe(HookUninstallResult.NotInstalled);
  });

  it('returns not_managed for unmanaged hook', () => {
    const repo = createGitRepo();
    writeFileSync(getHookPath(repo, HOOK_POST_CHECKOUT), "#!/bin/bash\necho 'existing hook'");
    expect(uninstallHook(repo, HOOK_POST_CHECKOUT)).toBe(HookUninstallResult.NotManaged);
  });

  it('removes appended snippet and preserves existing hook', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_CHECKOUT);
    writeFileSync(hookPath, "#!/bin/bash\necho 'existing hook'");
    await installHook(repo, HOOK_POST_CHECKOUT, async () => true);
    expect(uninstallHook(repo, HOOK_POST_CHECKOUT)).toBe(HookUninstallResult.Uninstalled);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).not.toContain(HOOK_MARKER);
  });
});

describe('post-commit hook', () => {
  it('installs hook', async () => {
    const repo = createGitRepo();
    expect(await installHook(repo, HOOK_POST_COMMIT)).toBe(HookInstallResult.Installed);
    const content = readFileSync(getHookPath(repo, HOOK_POST_COMMIT), 'utf8');
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain('on-commit');
  });

  it('detects already installed hook', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_COMMIT);
    expect(await installHook(repo, HOOK_POST_COMMIT)).toBe(HookInstallResult.AlreadyInstalled);
  });

  it('updates managed hook callback when stale', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_COMMIT);
    writeFileSync(hookPath, '#!/bin/bash\n# branch-ctx-managed\n\n"/missing/bctx" on-commit\n');
    expect(await installHook(repo, HOOK_POST_COMMIT)).toBe(HookInstallResult.Updated);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).not.toContain('/missing/bctx');
    expect(content).toContain('on-commit');
  });

  it('does not append unmanaged hook when declined', async () => {
    const repo = createGitRepo();
    writeFileSync(getHookPath(repo, HOOK_POST_COMMIT), "#!/bin/bash\necho 'existing hook'");
    expect(await installHook(repo, HOOK_POST_COMMIT, async () => false)).toBe(
      HookInstallResult.HookExists,
    );
  });

  it('appends unmanaged hook when confirmed', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_COMMIT);
    writeFileSync(hookPath, "#!/bin/bash\necho 'existing hook'");
    expect(await installHook(repo, HOOK_POST_COMMIT, async () => true)).toBe(
      HookInstallResult.Appended,
    );
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain('on-commit');
  });

  it('updates appended managed snippet when stale', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_COMMIT);
    writeFileSync(
      hookPath,
      '#!/bin/bash\necho \'existing hook\'\n# branch-ctx-managed\n"/missing/bctx" on-commit\n# branch-ctx-end\n',
    );
    expect(await installHook(repo, HOOK_POST_COMMIT)).toBe(HookInstallResult.Updated);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).not.toContain('/missing/bctx');
    expect(content).toContain('# branch-ctx-end');
  });

  it('checks if hook is installed', async () => {
    const repo = createGitRepo();
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(false);
    await installHook(repo, HOOK_POST_COMMIT);
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(true);
  });

  it('uninstalls hook', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_COMMIT);
    expect(uninstallHook(repo, HOOK_POST_COMMIT)).toBe(HookUninstallResult.Uninstalled);
    expect(existsSync(getHookPath(repo, HOOK_POST_COMMIT))).toBe(false);
  });

  it('returns not_installed when hook is missing', () => {
    expect(uninstallHook(createGitRepo(), HOOK_POST_COMMIT)).toBe(HookUninstallResult.NotInstalled);
  });

  it('returns not_managed for unmanaged hook', () => {
    const repo = createGitRepo();
    writeFileSync(getHookPath(repo, HOOK_POST_COMMIT), "#!/bin/bash\necho 'existing hook'");
    expect(uninstallHook(repo, HOOK_POST_COMMIT)).toBe(HookUninstallResult.NotManaged);
  });

  it('removes appended snippet and preserves existing hook', async () => {
    const repo = createGitRepo();
    const hookPath = getHookPath(repo, HOOK_POST_COMMIT);
    writeFileSync(hookPath, "#!/bin/bash\necho 'existing hook'");
    await installHook(repo, HOOK_POST_COMMIT, async () => true);
    expect(uninstallHook(repo, HOOK_POST_COMMIT)).toBe(HookUninstallResult.Uninstalled);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).not.toContain(HOOK_MARKER);
  });
});

describe('both hooks', () => {
  it('installs both hooks', async () => {
    const repo = createGitRepo();
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.Installed);
    expect(await installHook(repo, HOOK_POST_COMMIT)).toBe(HookInstallResult.Installed);
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(true);
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(true);
  });

  it('uninstalls both hooks', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_CHECKOUT);
    await installHook(repo, HOOK_POST_COMMIT);
    expect(uninstallHook(repo, HOOK_POST_CHECKOUT)).toBe(HookUninstallResult.Uninstalled);
    expect(uninstallHook(repo, HOOK_POST_COMMIT)).toBe(HookUninstallResult.Uninstalled);
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(false);
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(false);
  });

  it('keeps hook lifecycle independent', async () => {
    const repo = createGitRepo();
    await installHook(repo, HOOK_POST_CHECKOUT);
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(true);
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(false);
    await installHook(repo, HOOK_POST_COMMIT);
    uninstallHook(repo, HOOK_POST_CHECKOUT);
    expect(isHookInstalled(repo, HOOK_POST_CHECKOUT)).toBe(false);
    expect(isHookInstalled(repo, HOOK_POST_COMMIT)).toBe(true);
  });
});
