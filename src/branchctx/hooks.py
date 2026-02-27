from __future__ import annotations

import os
import re
import shutil
import stat
import sys
from typing import Literal

from branchctx.assets import get_post_checkout_hook_template, get_post_commit_hook_template
from branchctx.constants import CLI_NAME, GIT_DIR, HOOK_MARKER, HOOK_POST_CHECKOUT
from branchctx.git import git_current_branch, git_hooks_path, git_info_exclude_add, git_root

HookType = Literal["post-checkout", "post-commit"]
HookInstallResult = Literal["installed", "already_installed", "hook_exists", "appended", "skipped"]
HookUninstallResult = Literal["uninstalled", "not_installed", "not_managed"]

_custom_hooks_confirmed: dict[str, bool] = {}
_exclude_confirmed: dict[str, bool] = {}
_append_confirmed: dict[tuple[str, HookType], bool] = {}


def _reset_confirmation_state() -> None:
    _custom_hooks_confirmed.clear()
    _exclude_confirmed.clear()
    _append_confirmed.clear()


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
                hooks_dir = custom_path
            else:
                hooks_dir = os.path.join(git_root, custom_path)
            husky_dir = _get_husky_user_hooks_dir(hooks_dir)
            if husky_dir:
                return os.path.join(husky_dir, hook_type)
            return os.path.join(hooks_dir, hook_type)
    return os.path.join(git_root, GIT_DIR, "hooks", hook_type)


def get_custom_hooks_dir(git_root: str) -> str | None:
    custom_path = git_hooks_path(git_root)
    if not custom_path:
        return None
    if os.path.isabs(custom_path):
        return custom_path
    return os.path.join(git_root, custom_path)


def _is_husky_dir(hooks_dir: str) -> bool:
    return os.path.exists(os.path.join(hooks_dir, "h"))


def _get_husky_user_hooks_dir(hooks_dir: str) -> str | None:
    if not _is_husky_dir(hooks_dir):
        return None
    return os.path.dirname(hooks_dir)


def _prompt_yes_no(question: str) -> bool:
    while True:
        answer = input(f"{question} [y/n]: ").strip().lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer 'y' or 'n'.")


def _get_all_hook_paths(git_root: str, hook_type: HookType) -> list[str]:
    paths = [get_hook_path(git_root, hook_type, use_custom=False)]
    custom_hooks_dir = get_custom_hooks_dir(git_root)
    if custom_hooks_dir:
        paths.append(os.path.join(custom_hooks_dir, hook_type))
        husky_dir = _get_husky_user_hooks_dir(custom_hooks_dir)
        if husky_dir:
            paths.append(os.path.join(husky_dir, hook_type))
    return paths


def is_hook_installed(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT) -> bool:
    for hook_path in _get_all_hook_paths(git_root, hook_type):
        if os.path.exists(hook_path):
            with open(hook_path) as f:
                if HOOK_MARKER in f.read():
                    return True
    return False


def _get_hook_template(hook_type: HookType) -> str:
    if hook_type == HOOK_POST_CHECKOUT:
        return get_post_checkout_hook_template()
    return get_post_commit_hook_template()


SNIPPET_END_MARKER = "# branch-ctx-end"


def _get_append_snippet(hook_type: HookType) -> str:
    callback = get_callback(hook_type)
    if hook_type == HOOK_POST_CHECKOUT:
        return f"""
{HOOK_MARKER}
OLD_BRANCH=$(git rev-parse --abbrev-ref @{{-1}} 2>/dev/null || echo "unknown")
NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
{callback} "$OLD_BRANCH" "$NEW_BRANCH"
{SNIPPET_END_MARKER}
"""
    return f"""
{HOOK_MARKER}
{callback}
{SNIPPET_END_MARKER}
"""


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

        append_key = (git_root, hook_type)
        if append_key not in _append_confirmed:
            print(f"\nExisting {hook_type} hook detected (not managed by bctx)")
            do_append = _prompt_yes_no("Append bctx callback to existing hook?")
            _append_confirmed[append_key] = do_append

        if not _append_confirmed[append_key]:
            return "hook_exists"

        snippet = _get_append_snippet(hook_type)
        with open(hook_path, "a") as f:
            f.write(snippet)
        return "appended"

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


def _remove_bctx_snippet(content: str) -> str:
    pattern = rf"\n?{re.escape(HOOK_MARKER)}.*?{re.escape(SNIPPET_END_MARKER)}\n?"
    return re.sub(pattern, "", content, flags=re.DOTALL)


def _is_standalone_bctx_hook(content: str) -> bool:
    if SNIPPET_END_MARKER in content:
        cleaned = _remove_bctx_snippet(content)
        remaining = cleaned.strip()
        if not remaining:
            return True
        lines = [ln for ln in remaining.split("\n") if ln.strip() and not ln.strip().startswith("#!")]
        return len(lines) == 0
    lines = content.strip().split("\n")
    return len(lines) >= 2 and lines[1].strip() == HOOK_MARKER


def uninstall_hook(git_root: str, hook_type: HookType = HOOK_POST_CHECKOUT) -> HookUninstallResult:
    for hook_path in _get_all_hook_paths(git_root, hook_type):
        if not os.path.exists(hook_path):
            continue

        with open(hook_path) as f:
            content = f.read()

        if HOOK_MARKER not in content:
            continue

        if _is_standalone_bctx_hook(content):
            os.remove(hook_path)
        elif SNIPPET_END_MARKER in content:
            file_mode = os.stat(hook_path).st_mode
            cleaned = _remove_bctx_snippet(content)
            with open(hook_path, "w") as f:
                f.write(cleaned)
            os.chmod(hook_path, file_mode)
        else:
            os.remove(hook_path)

        return "uninstalled"

    for hook_path in _get_all_hook_paths(git_root, hook_type):
        if os.path.exists(hook_path):
            return "not_managed"

    return "not_installed"


def get_current_branch(path: str | None = None) -> str | None:
    return git_current_branch(path or os.getcwd())
