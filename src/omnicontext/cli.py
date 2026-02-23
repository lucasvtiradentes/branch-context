import os
import sys
from importlib.metadata import version as pkg_version

from omnicontext.config import Config, config_exists, get_branches_dir, get_config_dir, get_template_dir
from omnicontext.constants import (
    CONFIG_FILE,
    DEFAULT_TEMPLATE_CONTEXT,
    GITIGNORE_BRANCHES,
    GITIGNORE_ROOT,
    HOOK_MARKER,
    HOOK_TEMPLATE,
)
from omnicontext.hooks import (
    get_current_branch,
    get_default_callback,
    get_git_root,
    install_hook,
    is_hook_installed,
    uninstall_hook,
)
from omnicontext.sync import get_branch_dir, list_branches, sync_branch


def print_help():
    print("""omnicontext - Git branch context manager

Commands:
  init                 Initialize .omnicontext/ in current repo
  install              Install post-checkout hook
  install --global     Configure global hooks path (~/.git-hooks)
  uninstall            Remove hook from current repo
  sync                 Sync context for current branch
  branches             List all branch contexts
  status               Show status
  on-checkout          Called by hook on branch switch

Options:
  --callback <cmd>     Custom command for hook (install only)
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  omnicontext init                             # initialize project
  omnicontext install                          # install hook
  omnicontext sync                             # sync current branch
  omnicontext branches                         # list contexts

Exit codes:
  0 - success
  1 - error""")


def cmd_init(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    config_dir = get_config_dir(git_root)
    template_dir = get_template_dir(git_root)
    branches_dir = get_branches_dir(git_root)

    if config_exists(git_root):
        print(f"Already initialized: {config_dir}")
        return 0

    os.makedirs(config_dir, exist_ok=True)
    os.makedirs(template_dir, exist_ok=True)
    os.makedirs(branches_dir, exist_ok=True)

    config = Config()
    config.save(git_root)

    with open(os.path.join(template_dir, "context.md"), "w") as f:
        f.write(DEFAULT_TEMPLATE_CONTEXT)

    with open(os.path.join(branches_dir, ".gitignore"), "w") as f:
        f.write(GITIGNORE_BRANCHES)

    with open(os.path.join(config_dir, ".gitignore"), "w") as f:
        f.write(GITIGNORE_ROOT)

    print(f"Initialized: {config_dir}")
    print(f"  config:   {config_dir}/{CONFIG_FILE}")
    print(f"  template: {template_dir}/")
    print(f"  branches: {branches_dir}/ (gitignored)")
    print("")
    print("Next: run 'omnicontext install' to install the hook")
    return 0


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


def cmd_sync(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print("error: not initialized. Run 'omnicontext init' first")
        return 1

    branch = get_current_branch(git_root)
    if not branch:
        print("error: could not determine current branch")
        return 1

    result = sync_branch(git_root, branch)

    print(f"Branch:  {result['branch']}")
    print(f"Context: {result['branch_dir']}")
    print(f"Symlink: {result['symlink_path']} -> {result['branch_dir']}")

    if result["create_result"] == "created_from_template":
        print("Status:  created from template")
    elif result["create_result"] == "created_empty":
        print("Status:  created (no template)")
    else:
        print("Status:  exists")

    return 0


def cmd_branches(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print("error: not initialized. Run 'omnicontext init' first")
        return 1

    branches = list_branches(git_root)
    current = get_current_branch(git_root)

    if not branches:
        print("No branch contexts yet")
        return 0

    print(f"Branch contexts ({len(branches)}):\n")
    for b in sorted(branches):
        branch_dir = get_branch_dir(git_root, b)
        files = os.listdir(branch_dir) if os.path.exists(branch_dir) else []
        files = [f for f in files if not f.startswith(".")]
        marker = "*" if current and b == current.replace("/", "-") else " "
        print(f"  {marker} {b} ({len(files)} files)")

    return 0


def cmd_status(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    branch = get_current_branch(git_root)
    initialized = config_exists(git_root)
    hook_installed = is_hook_installed(git_root)

    print(f"Repository:  {git_root}")
    print(f"Branch:      {branch}")
    print(f"Initialized: {'yes' if initialized else 'no'}")
    print(f"Hook:        {'installed' if hook_installed else 'not installed'}")

    if initialized:
        config = Config.load(git_root)
        symlink_path = os.path.join(git_root, config.symlink)
        symlink_exists = os.path.islink(symlink_path)
        print(f"Symlink:     {config.symlink} ({'active' if symlink_exists else 'not set'})")

        branches = list_branches(git_root)
        print(f"Contexts:    {len(branches)} branches")

    global_hooks = os.popen("git config --global core.hooksPath 2>/dev/null").read().strip()
    if global_hooks:
        print(f"Global:      {global_hooks}")

    return 0


def cmd_on_checkout(args):
    if len(args) < 2:
        print("usage: omnicontext on-checkout <old_branch> <new_branch>")
        return 1

    old_branch = args[0]
    new_branch = args[1]

    git_root = get_git_root()
    if not git_root:
        return 1

    if not config_exists(git_root):
        print(f"Branch: {old_branch} -> {new_branch}")
        return 0

    result = sync_branch(git_root, new_branch)

    status = "new" if result["create_result"] != "exists" else "synced"
    print(f"Branch: {old_branch} -> {new_branch} ({status})")

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
        "init": cmd_init,
        "install": cmd_install,
        "uninstall": cmd_uninstall,
        "sync": cmd_sync,
        "branches": cmd_branches,
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
