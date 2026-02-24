from __future__ import annotations

import os
import shutil
import stat
import sys
from typing import Literal

from branchctx.assets import get_post_checkout_hook_template, get_post_commit_hook_template
from branchctx.constants import CLI_NAME, GIT_DIR, HOOK_MARKER, HOOK_POST_CHECKOUT
from branchctx.git import git_current_branch, git_hooks_path, git_info_exclude_add, git_root

HookType = Literal["post-checkout", "post-commit"]
HookInstallResult = Literal["installed", "already_installed", "hook_exists", "skipped"]
HookUninstallResult = Literal["uninstalled", "not_installed", "not_managed"]

_custom_hooks_confirmed: dict[str, bool] = {}
_exclude_confirmed: dict[str, bool] = {}


def get_branchctx_path() -> str:
    script_name = CLI_NAME

    if getattr(sys, "frozen", False):
        return sys.executable

    bin_dir = os.path.dirname(sys.executable)
    candidate = os.path.join(bin_dir, script_name)
    if os.path.exists(candidate):
        return candidate

    found = shutil.which(script_name)
    if found:
        return found

    return script_name


def get_callback(hook_type: HookType) -> str:
    branchctx_path = get_branchctx_path()
    if hook_type == HOOK_POST_CHECKOUT:
        return f'"{branchctx_path}" on-checkout'
    return f'"{branchctx_path}" on-commit'


def get_git_root(path: str | None = None) -> str | None:
    return git_root(path or os.getcwd())


def get_hook_path(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT, use_custom: bool = False) -> str:
    if use_custom:
        custom_path = git_hooks_path(git_root)
        if custom_path:
            if os.path.isabs(custom_path):
                return os.path.join(custom_path, hook_type)
            return os.path.join(git_root, custom_path, hook_type)
    return os.path.join(git_root, GIT_DIR, "hooks", hook_type)


def get_custom_hooks_dir(git_root: str) -> str | None:
    custom_path = git_hooks_path(git_root)
    if not custom_path:
        return None
    if os.path.isabs(custom_path):
        return custom_path
    return os.path.join(git_root, custom_path)


def _prompt_yes_no(question: str) -> bool:
    while True:
        answer = input(f"{question} [y/n]: ").strip().lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer 'y' or 'n'.")


def is_hook_installed(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT) -> bool:
    for use_custom in [True, False]:
        hook_path = get_hook_path(git_root, hook_type, use_custom=use_custom)
        if os.path.exists(hook_path):
            with open(hook_path) as f:
                if HOOK_MARKER in f.read():
                    return True
    return False


def _get_hook_template(hook_type: HookType) -> str:
    if hook_type == HOOK_POST_CHECKOUT:
        return get_post_checkout_hook_template()
    return get_post_commit_hook_template()


def install_hook(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT) -> HookInstallResult:
    global _custom_hooks_confirmed, _exclude_confirmed

    custom_hooks_dir = get_custom_hooks_dir(git_root)
    use_custom = False

    if custom_hooks_dir:
        if git_root not in _custom_hooks_confirmed:
            rel_path = os.path.relpath(custom_hooks_dir, git_root)
            print(f"\nDetected custom hooks directory: {rel_path}")
            use_custom = _prompt_yes_no("Install hooks in this directory?")
            _custom_hooks_confirmed[git_root] = use_custom

            if use_custom and git_root not in _exclude_confirmed:
                exclude_prompt = _prompt_yes_no("Exclude hooks from git tracking (.git/info/exclude)?")
                _exclude_confirmed[git_root] = exclude_prompt
            elif not use_custom:
                print(f"warning: hooks in .git/hooks/ won't run while core.hooksPath is set to '{rel_path}'")
        else:
            use_custom = _custom_hooks_confirmed[git_root]

    hook_path = get_hook_path(git_root, hook_type, use_custom=use_custom)
    hooks_dir = os.path.dirname(hook_path)

    if not os.path.exists(hooks_dir):
        os.makedirs(hooks_dir)

    if os.path.exists(hook_path):
        with open(hook_path) as f:
            existing = f.read()
        if HOOK_MARKER in existing:
            return "already_installed"
        return "hook_exists"

    template = _get_hook_template(hook_type)
    content = template.format(marker=HOOK_MARKER, callback=get_callback(hook_type))

    with open(hook_path, "w") as f:
        f.write(content)

    st = os.stat(hook_path)
    os.chmod(hook_path, st.st_mode | stat.S_IEXEC)

    if use_custom and _exclude_confirmed.get(git_root, False):
        rel_hook = os.path.relpath(hook_path, git_root)
        git_info_exclude_add(git_root, rel_hook)

    return "installed"


def uninstall_hook(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT) -> HookUninstallResult:
    for use_custom in [True, False]:
        hook_path = get_hook_path(git_root, hook_type, use_custom=use_custom)

        if not os.path.exists(hook_path):
            continue

        with open(hook_path) as f:
            content = f.read()

        if HOOK_MARKER not in content:
            continue

        os.remove(hook_path)
        return "uninstalled"

    default_path = get_hook_path(git_root, hook_type, use_custom=False)
    custom_path = get_hook_path(git_root, hook_type, use_custom=True)

    if os.path.exists(default_path) or os.path.exists(custom_path):
        return "not_managed"

    return "not_installed"


def get_current_branch(path: str | None = None) -> str | None:
    return git_current_branch(path or os.getcwd())
