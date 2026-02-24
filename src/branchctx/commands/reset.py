from __future__ import annotations

from branchctx.config import config_exists, list_templates
from branchctx.constants import CLI_NAME
from branchctx.hooks import get_current_branch, get_git_root
from branchctx.sync import reset_branch_context


def cmd_reset(args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print(f"error: {CLI_NAME} not initialized (run '{CLI_NAME} init')")
        return 1

    branch = get_current_branch(git_root)
    if not branch:
        print("error: could not determine current branch")
        return 1

    template = args[0] if args else None

    if template:
        templates = list_templates(git_root)
        if template not in templates:
            print(f"error: template '{template}' not found")
            print(f"available: {', '.join(templates)}")
            return 1

    result = reset_branch_context(git_root, branch, template)

    if result == "template_not_found":
        print("error: template not found")
        return 1

    template_used = template or "auto-detected"
    print(f"Reset context for '{branch}' (template: {template_used})")
    return 0
