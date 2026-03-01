from __future__ import annotations

from branchctx.constants import CLI_NAME
from branchctx.core.context_tags import update_context_tags
from branchctx.core.hooks import get_git_root
from branchctx.core.sync import sanitize_branch_name, sync_branch
from branchctx.data.branch_base import get_base_branch
from branchctx.data.config import config_exists
from branchctx.data.meta import update_branch_meta


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

    branch_key = sanitize_branch_name(new_branch)
    context_dir = result["branch_dir"]
    base_branch = get_base_branch(git_root, context_dir)

    update_branch_meta(git_root, branch_key, base_branch)

    update_context_tags(git_root, context_dir, branch_key, base_branch)

    status = "new" if result["create_result"] != "exists" else "synced"
    print(f"Branch: {old_branch} -> {new_branch} ({status})")

    return 0
