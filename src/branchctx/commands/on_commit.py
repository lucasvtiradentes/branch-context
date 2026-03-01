from __future__ import annotations

import os

from branchctx.constants import DEFAULT_SYMLINK
from branchctx.core.context_tags import update_context_tags
from branchctx.core.hooks import get_current_branch, get_git_root
from branchctx.core.sync import sanitize_branch_name
from branchctx.data.branch_base import get_base_branch
from branchctx.data.config import config_exists
from branchctx.data.meta import update_branch_meta


def cmd_on_commit(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        return 1

    if not config_exists(git_root):
        return 0

    branch = get_current_branch(git_root)
    if not branch:
        return 0

    branch_key = sanitize_branch_name(branch)
    context_dir = os.path.join(git_root, DEFAULT_SYMLINK)
    if not os.path.exists(context_dir):
        return 0

    base_branch = get_base_branch(git_root, context_dir)
    update_branch_meta(git_root, branch_key, base_branch)

    updates = update_context_tags(
        workspace=git_root,
        context_dir=context_dir,
        branch_key=branch_key,
        base_branch=base_branch,
    )

    if updates:
        print(f"Updated {len(updates)} tag(s) in context files:")
        for update in updates:
            rel_path = os.path.relpath(update.file, git_root)
            print(f"  {rel_path}: <{update.tag}>")

    return 0
