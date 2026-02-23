import sys
from importlib.metadata import version as pkg_version

from omnicontext.commands import (
    cmd_branches,
    cmd_init,
    cmd_install,
    cmd_on_checkout,
    cmd_status,
    cmd_sync,
    cmd_uninstall,
)


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
