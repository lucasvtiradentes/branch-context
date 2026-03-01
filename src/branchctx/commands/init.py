from __future__ import annotations

import os
from pathlib import Path

from branchctx.assets import copy_init_templates
from branchctx.constants import CLI_NAME, CONFIG_FILE, DEFAULT_SYMLINK, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT
from branchctx.core.hooks import get_current_branch, get_git_root, install_hook
from branchctx.core.sync import sync_branch
from branchctx.data.config import (
    Config,
    config_exists,
    get_branches_dir,
    get_config_dir,
    get_templates_dir,
)


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

        print(f"Initialized: {config_dir}")
        print(f"  config:    {config_dir}/{CONFIG_FILE}")
        print(f"  templates: {templates_dir}/")
        print(f"  branches:  {branches_dir}/ (gitignored)")

    checkout_result = install_hook(git_root, HOOK_POST_CHECKOUT)
    if checkout_result == "installed":
        print(f"Hook installed: {HOOK_POST_CHECKOUT}")
    elif checkout_result == "appended":
        print(f"Hook appended: {HOOK_POST_CHECKOUT}")
    elif checkout_result == "already_installed":
        if already_initialized:
            print("Already initialized")
    elif checkout_result == "hook_exists":
        print(f"warning: {HOOK_POST_CHECKOUT} hook exists but not managed by {CLI_NAME}")

    commit_result = install_hook(git_root, HOOK_POST_COMMIT)
    if commit_result == "installed":
        print(f"Hook installed: {HOOK_POST_COMMIT}")
    elif commit_result == "appended":
        print(f"Hook appended: {HOOK_POST_COMMIT}")
    elif commit_result == "hook_exists":
        print(f"warning: {HOOK_POST_COMMIT} hook exists but not managed by {CLI_NAME}")

    _add_to_gitignore(git_root, DEFAULT_SYMLINK)
    _add_to_gitignore(git_root, ".bctx/branches/")

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
