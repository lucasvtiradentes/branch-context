import os
import sys
from importlib.metadata import version as pkg_version

from omnicontext.hooks import (
    get_current_branch,
    get_default_callback,
    get_git_root,
    install_hook,
    is_hook_installed,
    uninstall_hook,
)


def print_help():
    print("""omnicontext - Git branch context manager

Commands:
  install              Install post-checkout hook in current repo
  install --global     Configure global hooks path (~/.git-hooks)
  uninstall            Remove hook from current repo
  status               Show hook status for current repo
  on-checkout          Called by hook on branch switch

Options:
  --callback <cmd>     Custom command to run on branch change (install only)
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  omnicontext install                          # install hook in current repo
  omnicontext install --callback "my-script"   # custom callback
  omnicontext status                           # check if hook installed

Exit codes:
  0 - success
  1 - error (not a git repo, hook already exists, etc.)""")


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
        global_hooks = os.path.expanduser("~/.git-hooks")
        os.makedirs(global_hooks, exist_ok=True)

        hook_path = os.path.join(global_hooks, "post-checkout")
        from omnicontext.constants import HOOK_MARKER, HOOK_TEMPLATE

        callback_cmd = callback or get_default_callback()
        content = HOOK_TEMPLATE.format(marker=HOOK_MARKER, callback=callback_cmd)

        with open(hook_path, "w") as f:
            f.write(content)
        os.chmod(hook_path, 0o755)

        os.system(f'git config --global core.hooksPath "{global_hooks}"')
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
        print("error: post-checkout hook already exists (not managed by omnicontext)")
        print("Remove it manually or use --force to overwrite")
        return 1

    return 1


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


def cmd_status(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    installed = is_hook_installed(git_root)
    branch = get_current_branch(git_root)

    print(f"Repository: {git_root}")
    print(f"Branch:     {branch}")
    print(f"Hook:       {'installed' if installed else 'not installed'}")

    global_hooks = os.popen("git config --global core.hooksPath 2>/dev/null").read().strip()
    if global_hooks:
        print(f"Global:     {global_hooks}")

    return 0


def cmd_on_checkout(args):
    if len(args) < 2:
        print("usage: omnicontext on-checkout <old_branch> <new_branch> [prev_head] [new_head]")
        return 1

    old_branch = args[0]
    new_branch = args[1]

    print(f"Branch changed: {old_branch} -> {new_branch}")

    return 0


def main():
    args = sys.argv[1:]

    if not args or "--help" in args or "-h" in args:
        print_help()
        return 0

    if "--version" in args or "-v" in args:
        print(pkg_version("omnicontext"))
        return 0

    cmd = args[0]
    cmd_args = args[1:]

    commands = {
        "install": cmd_install,
        "uninstall": cmd_uninstall,
        "status": cmd_status,
        "on-checkout": cmd_on_checkout,
    }

    if cmd in commands:
        sys.exit(commands[cmd](cmd_args))
    else:
        print(f"error: unknown command '{cmd}'")
        print("Run 'omnicontext --help' for usage")
        sys.exit(1)


if __name__ == "__main__":
    main()
