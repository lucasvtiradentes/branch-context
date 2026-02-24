from __future__ import annotations

import os
import platform
import re
import shlex
import shutil
import subprocess
from importlib import resources
from typing import Literal

from branchctx.config import Config, get_branches_dir, get_template_dir
from branchctx.constants import BRANCHES_DIR, CONFIG_DIR, DEFAULT_SOUND_FILE, DEFAULT_TEMPLATE, ENV_BRANCH, PACKAGE_NAME


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
    if template is None:
        config = Config.load(workspace)
        template = config.get_template_for_branch(branch)

    template_dir = get_template_dir(workspace, template)

    if not os.path.exists(template_dir):
        template_dir = get_template_dir(workspace, DEFAULT_TEMPLATE)

    if not os.path.exists(template_dir):
        return None

    return template_dir


def _copy_template_to_branch(template_dir: str, branch_dir: str):
    for item in os.listdir(template_dir):
        src = os.path.join(template_dir, item)
        dst = os.path.join(branch_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)


def create_branch_context(
    workspace: str, branch: str, template: str | None = None
) -> Literal["exists", "created_from_template", "created_empty"]:
    branch_dir = get_branch_dir(workspace, branch)

    if os.path.exists(branch_dir):
        return "exists"

    os.makedirs(branch_dir, exist_ok=True)

    template_dir = _resolve_template_dir(workspace, branch, template)

    if template_dir:
        _copy_template_to_branch(template_dir, branch_dir)
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
    _copy_template_to_branch(template_dir, branch_dir)

    return "reset"


def update_symlink(workspace: str, branch: str, config: Config) -> Literal["unchanged", "error_not_symlink", "updated"]:
    branch_dir = get_branch_dir(workspace, branch)
    symlink_path = os.path.join(workspace, config.symlink)

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


def run_on_switch(workspace: str, branch: str, config: Config):
    if not config.on_switch:
        return

    cmd = config.on_switch.replace("{branch}", shlex.quote(branch))

    subprocess.run(
        cmd,
        shell=True,
        cwd=workspace,
        env={**os.environ, ENV_BRANCH: branch},
    )


def sync_branch(workspace: str, branch: str) -> dict:
    config = Config.load(workspace)

    create_result = create_branch_context(workspace, branch)
    symlink_result = update_symlink(workspace, branch, config)

    run_on_switch(workspace, branch, config)

    if config.sound:
        play_sound(config.sound_file)

    return {
        "branch": branch,
        "branch_dir": get_branch_dir(workspace, branch),
        "create_result": create_result,
        "symlink_result": symlink_result,
        "symlink_path": config.symlink,
    }


def list_branches(workspace: str) -> list[str]:
    branches_dir = get_branches_dir(workspace)
    if not os.path.exists(branches_dir):
        return []

    return [
        d for d in os.listdir(branches_dir) if os.path.isdir(os.path.join(branches_dir, d)) and not d.startswith(".")
    ]
