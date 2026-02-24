from __future__ import annotations

from branchctx.config import config_exists
from branchctx.constants import CLI_NAME
from branchctx.hooks import get_git_root
from branchctx.sync import sync_branch


def cmd_on_checkout(args: list[str]) -> int:
    if len(args) < 2:
        print(f"usage: {CLI_NAME} on-checkout <old_branch> <new_branch>")
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
