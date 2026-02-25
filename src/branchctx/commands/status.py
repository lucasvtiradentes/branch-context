from __future__ import annotations

import os

from branchctx.config import Config, config_exists, get_templates_dir, list_templates
from branchctx.constants import CLI_NAME, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT
from branchctx.git import git_config_get, git_list_branches
from branchctx.hooks import get_current_branch, get_git_root, is_hook_installed
from branchctx.sync import list_branches, sanitize_branch_name

STATUS_OK = "[ok]"
STATUS_ERROR = "[!!]"
STATUS_WARN = "[--]"


def cmd_status(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    initialized = config_exists(git_root)
    if not initialized:
        print(f"error: {CLI_NAME} not initialized")
        print(f"run: {CLI_NAME} init")
        return 1

    branch = get_current_branch(git_root)
    config = Config.load(git_root)

    symlink_path = os.path.join(git_root, config.symlink)
    symlink_target = None
    if os.path.islink(symlink_path):
        symlink_target = os.readlink(symlink_path)

    print(f"Repository:  {git_root}")
    print(f"Branch:      {branch}")
    if symlink_target:
        print(f"Symlink:     {config.symlink} -> {symlink_target}")
    else:
        print(f"Symlink:     {config.symlink} (not set)")

    hooks = []
    if is_hook_installed(git_root, HOOK_POST_CHECKOUT):
        hooks.append(HOOK_POST_CHECKOUT)
    if is_hook_installed(git_root, HOOK_POST_COMMIT):
        hooks.append(HOOK_POST_COMMIT)
    print(f"Hooks:       {', '.join(hooks) if hooks else 'none'}")

    templates = list_templates(git_root)
    print(f"Templates:   {', '.join(templates) if templates else 'none'}")

    branches = list_branches(git_root)
    print(f"Contexts:    {len(branches)} branches")

    global_hooks = git_config_get("core.hooksPath", scope="global")
    if global_hooks:
        print(f"Global:      {global_hooks}")

    print()
    print("Health:")

    issues = []
    warnings = []

    if is_hook_installed(git_root, HOOK_POST_CHECKOUT):
        print(f"  {STATUS_OK} {HOOK_POST_CHECKOUT} hook installed")
    else:
        issues.append(f"{HOOK_POST_CHECKOUT} hook not installed")
        print(f"  {STATUS_ERROR} {HOOK_POST_CHECKOUT} hook not installed")

    if config.changed_files.enabled:
        if is_hook_installed(git_root, HOOK_POST_COMMIT):
            print(f"  {STATUS_OK} {HOOK_POST_COMMIT} hook installed")
        else:
            warnings.append(f"{HOOK_POST_COMMIT} hook not installed (changed_files enabled)")
            print(f"  {STATUS_WARN} {HOOK_POST_COMMIT} hook not installed")

    templates_dir = get_templates_dir(git_root)
    if os.path.exists(templates_dir):
        print(f"  {STATUS_OK} templates/ exists")
    else:
        issues.append("templates/ missing")
        print(f"  {STATUS_ERROR} templates/ missing")

    if config.default_template in templates:
        print(f"  {STATUS_OK} {config.default_template} template exists")
    else:
        issues.append(f"{config.default_template} template missing")
        print(f"  {STATUS_ERROR} {config.default_template} template missing")

    if os.path.islink(symlink_path):
        if os.path.exists(os.path.join(git_root, symlink_target)):
            print(f"  {STATUS_OK} symlink valid")
        else:
            issues.append("symlink points to non-existent target")
            print(f"  {STATUS_ERROR} symlink broken -> {symlink_target}")
    elif os.path.exists(symlink_path):
        issues.append("symlink path exists but is not a symlink")
        print(f"  {STATUS_ERROR} {config.symlink} is not a symlink")
    else:
        warnings.append(f"symlink not set (run '{CLI_NAME} sync')")
        print(f"  {STATUS_WARN} symlink not set")

    git_branches = git_list_branches(git_root)
    git_branches_sanitized = {sanitize_branch_name(b) for b in git_branches}
    context_branches = set(list_branches(git_root))

    orphans = context_branches - git_branches_sanitized
    if orphans:
        warnings.append(f"{len(orphans)} orphan contexts")
        print(f"  {STATUS_WARN} {len(orphans)} orphan contexts")
    else:
        print(f"  {STATUS_OK} no orphan contexts")

    if issues:
        return 1
    return 0
