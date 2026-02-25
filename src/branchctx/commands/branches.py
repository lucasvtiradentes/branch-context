from __future__ import annotations

import os

from branchctx.config import config_exists
from branchctx.constants import CLI_NAME
from branchctx.git import git_list_branches
from branchctx.hooks import get_current_branch, get_git_root
from branchctx.sync import (
    archive_branch,
    get_branch_dir,
    list_archived_branches,
    list_branches,
    sanitize_branch_name,
)


def _print_help():
    print("""usage: bctx branches <command>

Commands:
  list    List all branch contexts
  prune   Archive orphan contexts""")


def cmd_branches(args: list[str]) -> int:
    if not args:
        _print_help()
        return 1

    subcommand = args[0]

    if subcommand in ("-h", "--help"):
        _print_help()
        return 0

    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print(f"error: not initialized. Run '{CLI_NAME} init' first")
        return 1

    if subcommand == "list":
        return _cmd_list(git_root)
    elif subcommand == "prune":
        return _cmd_prune(git_root)
    else:
        print(f"error: unknown subcommand '{subcommand}'")
        _print_help()
        return 1


def _cmd_list(git_root: str) -> int:
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
        marker = "*" if current and b == sanitize_branch_name(current) else " "
        print(f"  {marker} {b} ({len(files)} files)")

    archived = list_archived_branches(git_root)
    if archived:
        print(f"\nArchived: {len(archived)}")

    return 0


def _cmd_prune(git_root: str) -> int:
    branches = list_branches(git_root)
    git_branches = git_list_branches(git_root)
    git_branches_sanitized = {sanitize_branch_name(b) for b in git_branches}

    orphans = set(branches) - git_branches_sanitized

    if not orphans:
        print("No orphan contexts to prune")
        return 0

    print(f"Archiving {len(orphans)} orphan contexts:\n")
    for orphan in sorted(orphans):
        if archive_branch(git_root, orphan):
            print(f"  {orphan}")

    print(f"\nDone. Use '{CLI_NAME} branches list' to see current contexts.")
    return 0
