import os

from omnicontext.hooks import get_git_root, uninstall_hook


def cmd_uninstall(args):
    if "--global" in args:
        os.system("git config --global --unset core.hooksPath")
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
        print("error: hook exists but not managed by omnicontext")
        return 1

    return 1
