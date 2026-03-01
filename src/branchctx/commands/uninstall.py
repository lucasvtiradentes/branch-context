from __future__ import annotations

from branchctx.constants import CLI_NAME, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT
from branchctx.core.hooks import get_git_root, uninstall_hook
from branchctx.utils.git import git_config_unset


def cmd_uninstall(args: list[str]) -> int:
    if "--global" in args:
        git_config_unset("core.hooksPath", scope="global")
        print("Global hooks path unset")
        return 0

    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    checkout_result = uninstall_hook(git_root, HOOK_POST_CHECKOUT)
    commit_result = uninstall_hook(git_root, HOOK_POST_COMMIT)

    if checkout_result == "uninstalled":
        print(f"Hook removed: {HOOK_POST_CHECKOUT}")
    elif checkout_result == "not_managed":
        print(f"warning: {HOOK_POST_CHECKOUT} hook exists but not managed by {CLI_NAME}")

    if commit_result == "uninstalled":
        print(f"Hook removed: {HOOK_POST_COMMIT}")
    elif commit_result == "not_managed":
        print(f"warning: {HOOK_POST_COMMIT} hook exists but not managed by {CLI_NAME}")

    if checkout_result == "not_installed" and commit_result == "not_installed":
        print("No hooks installed")

    return 0
