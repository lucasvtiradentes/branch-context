import sys
from importlib.metadata import version as pkg_version

from branchctx.constants import CLI_NAME, DIST_NAME
from branchctx.registry import COMMANDS, get_all_command_names, get_command_handler


def print_help():
    cmd_lines = []
    for name, info in COMMANDS.items():
        args = f" {info['args']}" if info["args"] else ""
        label = f"{name}{args}"
        cmd_lines.append(f"  {label:<20} {info['desc']}")

    commands_str = "\n".join(cmd_lines)

    print(f"""{CLI_NAME} - Git branch context manager

Commands:
{commands_str}

Options:
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  {CLI_NAME} init                             # initialize + install hook
  {CLI_NAME} status                           # show status and health
  {CLI_NAME} branches list                    # list contexts
  {CLI_NAME} branches prune                   # archive orphan contexts
  {CLI_NAME} reset                            # reset to auto-detected template
  {CLI_NAME} reset feature                    # reset to feature template
  {CLI_NAME} completion zsh                   # generate zsh completion

Exit codes:
  0 - success
  1 - error""")


def main():
    args = sys.argv[1:]

    if not args or "--help" in args or "-h" in args:
        print_help()
        sys.exit(0)

    if "--version" in args or "-v" in args:
        print(pkg_version(DIST_NAME))
        sys.exit(0)

    cmd = args[0]
    cmd_args = args[1:]

    if cmd in get_all_command_names():
        handler = get_command_handler(cmd)
        sys.exit(handler(cmd_args))
    else:
        print(f"error: unknown command '{cmd}'")
        print(f"Run '{CLI_NAME} --help' for usage")
        sys.exit(1)


if __name__ == "__main__":
    main()
