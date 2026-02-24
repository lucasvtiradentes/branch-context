from __future__ import annotations

import os
from pathlib import Path

from branchctx.assets import copy_init_templates, get_gitignore
from branchctx.config import Config, config_exists, get_branches_dir, get_config_dir, get_templates_dir
from branchctx.constants import CONFIG_FILE
from branchctx.hooks import get_current_branch, get_git_root, install_hook
from branchctx.sync import sync_branch


def cmd_init(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    config_dir = get_config_dir(git_root)
    templates_dir = get_templates_dir(git_root)
    branches_dir = get_branches_dir(git_root)

    already_initialized = config_exists(git_root)

    if not already_initialized:
        os.makedirs(config_dir, exist_ok=True)
        os.makedirs(branches_dir, exist_ok=True)

        config = Config()
        config.save(git_root)

        copy_init_templates(Path(templates_dir))

        with open(os.path.join(config_dir, ".gitignore"), "w") as f:
            f.write(get_gitignore())

        print(f"Initialized: {config_dir}")
        print(f"  config:    {config_dir}/{CONFIG_FILE}")
        print(f"  templates: {templates_dir}/")
        print(f"  branches:  {branches_dir}/ (gitignored)")

    hook_result = install_hook(git_root)

    if hook_result == "installed":
        print("Hook installed")
    elif hook_result == "already_installed":
        if already_initialized:
            print("Already initialized")
    elif hook_result == "hook_exists":
        print("warning: post-checkout hook exists but not managed by branchctx")

    config = Config.load(git_root)
    _add_to_gitignore(git_root, config.symlink)

    branch = get_current_branch(git_root)
    if branch:
        sync_branch(git_root, branch)
        print(f"Synced: {branch}")

    return 0


def _add_to_gitignore(git_root: str, symlink: str):
    gitignore_file = os.path.join(git_root, ".gitignore")

    existing = ""
    if os.path.exists(gitignore_file):
        with open(gitignore_file) as f:
            existing = f.read()

    if symlink not in existing.splitlines():
        with open(gitignore_file, "a") as f:
            if existing and not existing.endswith("\n"):
                f.write("\n")
            f.write(f"{symlink}\n")
