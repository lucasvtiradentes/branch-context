from __future__ import annotations

import os

from branchctx.config import Config, config_exists, list_templates
from branchctx.git import git_config_get
from branchctx.hooks import get_current_branch, get_git_root, is_hook_installed
from branchctx.sync import list_branches


def cmd_status(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    branch = get_current_branch(git_root)
    initialized = config_exists(git_root)
    hook_installed = is_hook_installed(git_root)

    print(f"Repository:  {git_root}")
    print(f"Branch:      {branch}")
    print(f"Initialized: {'yes' if initialized else 'no'}")
    print(f"Hook:        {'installed' if hook_installed else 'not installed'}")

    if initialized:
        config = Config.load(git_root)
        symlink_path = os.path.join(git_root, config.symlink)
        symlink_exists = os.path.islink(symlink_path)
        print(f"Symlink:     {config.symlink} ({'active' if symlink_exists else 'not set'})")

        templates = list_templates(git_root)
        print(f"Templates:   {', '.join(templates) if templates else 'none'}")

        branches = list_branches(git_root)
        print(f"Contexts:    {len(branches)} branches")

    global_hooks = git_config_get("core.hooksPath", scope="global")
    if global_hooks:
        print(f"Global:      {global_hooks}")

    return 0
