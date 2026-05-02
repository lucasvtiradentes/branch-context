import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
import { createGitRepo } from './helpers';

describe('post-checkout hook', () => {
  it('installs hook', async () => {
    const repo = createGitRepo();
    resetConfirmationState();
    expect(await installHook(repo, HOOK_POST_CHECKOUT)).toBe(HookInstallResult.Installed);
    const content = readFileSync(getHookPath(repo, HOOK_POST_CHECKOUT), 'utf8');
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain('on-checkout');
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
