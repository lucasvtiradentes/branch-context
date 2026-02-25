from __future__ import annotations

from branchctx.config import Config, config_exists
from branchctx.constants import CLI_NAME
from branchctx.context_tags import update_context_tags
from branchctx.hooks import get_git_root
from branchctx.meta import create_branch_meta, update_branch_meta
from branchctx.sync import get_branch_dir, sanitize_branch_name, sync_branch


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

    config = Config.load(git_root)
    branch_key = sanitize_branch_name(new_branch)

    create_branch_meta(git_root, branch_key, new_branch)
    update_branch_meta(git_root, branch_key, config.changed_files.base_branch)

    if config.changed_files.enabled:
        context_dir = get_branch_dir(git_root, new_branch)
        update_context_tags(git_root, context_dir, branch_key, config.changed_files.base_branch)

    status = "new" if result["create_result"] != "exists" else "synced"
    print(f"Branch: {old_branch} -> {new_branch} ({status})")

    return 0
