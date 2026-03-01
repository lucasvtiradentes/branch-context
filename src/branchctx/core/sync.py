from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
from importlib import resources
from typing import Literal

from branchctx.constants import (
    ARCHIVED_DIR,
    BRANCHES_DIR,
    CONFIG_DIR,
    DEFAULT_SOUND_FILE,
    DEFAULT_SYMLINK,
    PACKAGE_NAME,
    TEMPLATE_FILE_EXTENSIONS,
)
from branchctx.data.config import Config, get_branches_dir, get_default_template, get_template_dir
from branchctx.data.meta import archive_branch_meta, create_branch_meta
from branchctx.utils.template import get_template_variables, render_template_content


def get_default_sound_file() -> str | None:
    try:
        return str(resources.files(f"{PACKAGE_NAME}.assets").joinpath(DEFAULT_SOUND_FILE))
    except Exception:
        return None


def play_sound(sound_file: str | None):
    if sound_file is None:
        sound_file = get_default_sound_file()

    if sound_file is None or not os.path.exists(sound_file):
        return

    try:
        system = platform.system()
        if system == "Darwin":
            subprocess.Popen(["afplay", sound_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Linux":
            subprocess.Popen(["paplay", sound_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Windows":
            cmd = f"(New-Object Media.SoundPlayer '{sound_file}').Play()"
            subprocess.Popen(["powershell", "-c", cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        pass


def sanitize_branch_name(branch: str) -> str:
    return re.sub(r'[/\\:*?"<>|~^@\[\]\s]', "-", branch)


def get_branch_dir(workspace: str, branch: str) -> str:
    safe_name = sanitize_branch_name(branch)
    return os.path.join(get_branches_dir(workspace), safe_name)


def get_branch_rel_path(branch: str) -> str:
    return f"{CONFIG_DIR}/{BRANCHES_DIR}/{sanitize_branch_name(branch)}"


def branch_context_exists(workspace: str, branch: str) -> bool:
    return os.path.exists(get_branch_dir(workspace, branch))


def _resolve_template_dir(workspace: str, branch: str, template: str | None) -> str | None:
    explicit = template is not None

    if template is None:
        config = Config.load(workspace)
        template = config.get_template_for_branch(branch)

    template_dir = get_template_dir(workspace, template)

    if not os.path.exists(template_dir):
        if explicit:
            return None
        template_dir = get_template_dir(workspace, get_default_template())

    if not os.path.exists(template_dir):
        return None

    return template_dir


def _copy_template_to_branch(template_dir: str, branch_dir: str, branch: str):
    variables = get_template_variables(branch)

    def copy_with_render(src_dir: str, dst_dir: str):
        for item in os.listdir(src_dir):
            src = os.path.join(src_dir, item)
            dst = os.path.join(dst_dir, item)
            if os.path.isdir(src):
                os.makedirs(dst, exist_ok=True)
                copy_with_render(src, dst)
            elif item.endswith(TEMPLATE_FILE_EXTENSIONS):
                with open(src, "r") as f:
                    content = f.read()
                rendered = render_template_content(content, variables)
                with open(dst, "w") as f:
                    f.write(rendered)
            else:
                shutil.copy2(src, dst)

    copy_with_render(template_dir, branch_dir)


def create_branch_context(
    workspace: str, branch: str, template: str | None = None
) -> Literal["exists", "created_from_template", "created_empty"]:
    branch_dir = get_branch_dir(workspace, branch)
    branch_key = sanitize_branch_name(branch)

    if os.path.exists(branch_dir):
        return "exists"

    os.makedirs(branch_dir, exist_ok=True)
    create_branch_meta(workspace, branch_key, branch)

    template_dir = _resolve_template_dir(workspace, branch, template)

    if template_dir:
        _copy_template_to_branch(template_dir, branch_dir, branch)
        return "created_from_template"

    return "created_empty"


def reset_branch_context(
    workspace: str, branch: str, template: str | None = None
) -> Literal["reset", "template_not_found"]:
    branch_dir = get_branch_dir(workspace, branch)
    template_dir = _resolve_template_dir(workspace, branch, template)

    if not template_dir:
        return "template_not_found"

    if os.path.exists(branch_dir):
        shutil.rmtree(branch_dir)

    os.makedirs(branch_dir, exist_ok=True)
    _copy_template_to_branch(template_dir, branch_dir, branch)

    return "reset"


def update_symlink(workspace: str, branch: str) -> Literal["unchanged", "error_not_symlink", "updated"]:
    branch_dir = get_branch_dir(workspace, branch)
    symlink_path = os.path.join(workspace, DEFAULT_SYMLINK)

    if not os.path.exists(branch_dir):
        create_branch_context(workspace, branch)

    rel_path = os.path.relpath(branch_dir, workspace)

    if os.path.islink(symlink_path):
        current_target = os.readlink(symlink_path)
        if current_target == rel_path:
            return "unchanged"
        os.remove(symlink_path)
    elif os.path.exists(symlink_path):
        return "error_not_symlink"

    os.symlink(rel_path, symlink_path)
    return "updated"


def sync_branch(workspace: str, branch: str) -> dict:
    config = Config.load(workspace)

    create_result = create_branch_context(workspace, branch)
    symlink_result = update_symlink(workspace, branch)

    if config.sound:
        play_sound(config.sound_file)

    return {
        "branch": branch,
        "branch_dir": get_branch_dir(workspace, branch),
        "create_result": create_result,
        "symlink_result": symlink_result,
        "symlink_path": DEFAULT_SYMLINK,
    }


def list_branches(workspace: str) -> list[str]:
    branches_dir = get_branches_dir(workspace)
    if not os.path.exists(branches_dir):
        return []

    return [
        d
        for d in os.listdir(branches_dir)
        if os.path.isdir(os.path.join(branches_dir, d)) and not d.startswith(".") and d != ARCHIVED_DIR
    ]


def get_archived_dir(workspace: str) -> str:
    return os.path.join(get_branches_dir(workspace), ARCHIVED_DIR)


def list_archived_branches(workspace: str) -> list[str]:
    archived_dir = get_archived_dir(workspace)
    if not os.path.exists(archived_dir):
        return []

    return [d for d in os.listdir(archived_dir) if os.path.isdir(os.path.join(archived_dir, d))]


def archive_branch(workspace: str, branch_name: str) -> bool:
    branches_dir = get_branches_dir(workspace)
    archived_dir = get_archived_dir(workspace)
    src = os.path.join(branches_dir, branch_name)
    dst = os.path.join(archived_dir, branch_name)

    if not os.path.exists(src):
        return False

    os.makedirs(archived_dir, exist_ok=True)
    shutil.move(src, dst)
    archive_branch_meta(workspace, branch_name)
    return True
