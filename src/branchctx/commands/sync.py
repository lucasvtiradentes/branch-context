from __future__ import annotations

from branchctx.constants import CLI_NAME
from branchctx.core.context_tags import update_context_tags
from branchctx.core.hooks import get_current_branch, get_git_root
from branchctx.core.sync import sanitize_branch_name, sync_branch
from branchctx.data.branch_base import get_base_branch
from branchctx.data.config import config_exists
from branchctx.data.meta import update_branch_meta


def cmd_sync(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print(f"error: not initialized. Run '{CLI_NAME} init' first")
        return 1

    branch = get_current_branch(git_root)
    if not branch:
        print("error: could not determine current branch")
        return 1

    result = sync_branch(git_root, branch)

    branch_key = sanitize_branch_name(branch)
    context_dir = result["branch_dir"]
    base_branch = get_base_branch(git_root, context_dir)

    update_branch_meta(git_root, branch_key, base_branch)

    updates = update_context_tags(git_root, context_dir, branch_key, base_branch)

    print(f"Branch:  {result['branch']}")
    print(f"Context: {result['branch_dir']}")
    print(f"Symlink: {result['symlink_path']} -> {result['branch_dir']}")
    print(f"Base:    {base_branch}")

    if result["create_result"] == "created_from_template":
        print("Status:  created from template")
    elif result["create_result"] == "created_empty":
        print("Status:  created (no template)")
    else:
        print("Status:  synced")

    if updates:
        print(f"Updated: {len(updates)} tag(s)")

    return 0
