from omnicontext.constants import CLI_NAME
from omnicontext.hooks import get_git_root, install_hook


def cmd_install(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    result = install_hook(git_root)

    if result == "installed":
        print(f"Hook installed: {git_root}")
        return 0
    elif result == "already_installed":
        print("Hook already installed")
        return 0
    elif result == "hook_exists":
        print(f"error: post-checkout hook already exists (not managed by {CLI_NAME})")
        print("Remove it manually or use --force to overwrite")
        return 1

    return 1
