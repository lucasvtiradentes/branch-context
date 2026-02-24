from __future__ import annotations

from branchctx.constants import CLI_NAME
from branchctx.git import git_config_unset
from branchctx.hooks import get_git_root, uninstall_hook


def cmd_uninstall(args: list[str]) -> int:
    if "--global" in args:
        git_config_unset("core.hooksPath", scope="global")
        print("Global hooks path unset")
        return 0

    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    result = uninstall_hook(git_root)

    if result == "uninstalled":
        print("Hook removed")
        return 0
    elif result == "not_installed":
        print("No hook installed")
        return 0
    elif result == "not_managed":
        print(f"error: hook exists but not managed by {CLI_NAME}")
        return 1

    return 1
