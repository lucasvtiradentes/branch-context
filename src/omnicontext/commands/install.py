import os

from omnicontext.assets import get_hook_template
from omnicontext.constants import CLI_NAME, GLOBAL_HOOKS_DIR, HOOK_MARKER, HOOK_NAME
from omnicontext.git import git_config_set
from omnicontext.hooks import get_default_callback, get_git_root, install_hook


def cmd_install(args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    callback = None
    if "--callback" in args:
        idx = args.index("--callback")
        if idx + 1 < len(args):
            callback = args[idx + 1]

    if "--global" in args:
        global_hooks = os.path.expanduser(GLOBAL_HOOKS_DIR)
        os.makedirs(global_hooks, exist_ok=True)

        hook_path = os.path.join(global_hooks, HOOK_NAME)

        callback_cmd = callback or get_default_callback()
        content = get_hook_template().format(marker=HOOK_MARKER, callback=callback_cmd)

        with open(hook_path, "w") as f:
            f.write(content)
        os.chmod(hook_path, 0o755)

        git_config_set("core.hooksPath", global_hooks, scope="global")
        print(f"Global hooks configured: {global_hooks}")
        print("All repos will now use this hook")
        return 0

    result = install_hook(git_root, callback)

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
