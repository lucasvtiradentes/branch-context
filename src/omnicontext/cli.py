import sys
from importlib.metadata import version as pkg_version

from omnicontext.commands import (
    cmd_branches,
    cmd_init,
    cmd_on_checkout,
    cmd_status,
    cmd_sync,
    cmd_uninstall,
)
from omnicontext.constants import CLI_NAME, PACKAGE_NAME


def print_help():
    print(f"""{CLI_NAME} - Git branch context manager

Commands:
  init                 Initialize and install hook
  uninstall            Remove hook from current repo
  sync                 Sync context for current branch
  branches             List all branch contexts
  status               Show status

Options:
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  {CLI_NAME} init                             # initialize + install hook
  {CLI_NAME} sync                             # sync current branch
  {CLI_NAME} branches                         # list contexts

Exit codes:
  0 - success
  1 - error""")


def main():
    args = sys.argv[1:]

    if not args or "--help" in args or "-h" in args:
        print_help()
        return 0

    if "--version" in args or "-v" in args:
        print(pkg_version(PACKAGE_NAME))
        return 0

    cmd = args[0]
    cmd_args = args[1:]

    commands = {
        "init": cmd_init,
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
        print(f"Run '{CLI_NAME} --help' for usage")
        sys.exit(1)


if __name__ == "__main__":
    main()
