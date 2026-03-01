from __future__ import annotations

import json
import os

from branchctx.constants import CONFIG_DIR, CONFIG_FILE, DEFAULT_BASE_BRANCH


def _get_config_default_base_branch(workspace: str) -> str:
    config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                data = json.load(f)
                return data.get("default_base_branch", DEFAULT_BASE_BRANCH)
        except (json.JSONDecodeError, OSError):
            pass
    return DEFAULT_BASE_BRANCH


def get_base_branch(workspace: str, branch_dir: str) -> str:
    file_path = os.path.join(branch_dir, "base_branch")
    if os.path.exists(file_path):
        with open(file_path) as f:
            return f.read().strip()
    return _get_config_default_base_branch(workspace)


def save_base_branch(branch_dir: str, base: str):
    file_path = os.path.join(branch_dir, "base_branch")
    with open(file_path, "w") as f:
        f.write(base + "\n")
