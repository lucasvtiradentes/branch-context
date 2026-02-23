import os
import shutil
import subprocess

from omnicontext.config import Config, get_branches_dir, get_template_dir


def sanitize_branch_name(branch: str) -> str:
    return branch.replace("/", "-")


def get_branch_dir(workspace: str, branch: str) -> str:
    safe_name = sanitize_branch_name(branch)
    return os.path.join(get_branches_dir(workspace), safe_name)


def branch_context_exists(workspace: str, branch: str) -> bool:
    return os.path.exists(get_branch_dir(workspace, branch))


def create_branch_context(workspace: str, branch: str) -> str:
    branch_dir = get_branch_dir(workspace, branch)
    template_dir = get_template_dir(workspace)

    if os.path.exists(branch_dir):
        return "exists"

    os.makedirs(branch_dir, exist_ok=True)

    if os.path.exists(template_dir):
        for item in os.listdir(template_dir):
            src = os.path.join(template_dir, item)
            dst = os.path.join(branch_dir, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
        return "created_from_template"

    return "created_empty"


def update_symlink(workspace: str, branch: str, config: Config) -> str:
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

    cmd = config.on_switch.replace("{branch}", branch)

    subprocess.run(
        cmd,
        shell=True,
        cwd=workspace,
        env={**os.environ, "OMNICONTEXT_BRANCH": branch},
    )


def sync_branch(workspace: str, branch: str) -> dict:
    config = Config.load(workspace)

    create_result = create_branch_context(workspace, branch)
    symlink_result = update_symlink(workspace, branch, config)

    run_on_switch(workspace, branch, config)

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
