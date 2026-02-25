from __future__ import annotations

import os

from branchctx.config import Config, config_exists
from branchctx.context_tags import update_context_tags
from branchctx.hooks import get_current_branch, get_git_root
from branchctx.meta import update_branch_meta
from branchctx.sync import sanitize_branch_name


def cmd_on_commit(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        return 1

    if not config_exists(git_root):
        return 0

    config = Config.load(git_root)
    branch = get_current_branch(git_root)
    if not branch:
        return 0

    branch_key = sanitize_branch_name(branch)
    update_branch_meta(git_root, branch_key, config.changed_files.base_branch)

    if not config.changed_files.enabled:
        return 0

    context_dir = os.path.join(git_root, config.symlink)
    if not os.path.exists(context_dir):
        return 0

    updates = update_context_tags(
        workspace=git_root,
        context_dir=context_dir,
        branch_key=branch_key,
        base_branch=config.changed_files.base_branch,
    )

    if updates:
        print(f"Updated {len(updates)} tag(s) in context files:")
        for update in updates:
            rel_path = os.path.relpath(update.file, git_root)
            print(f"  {rel_path}: <{update.tag}>")

    return 0
