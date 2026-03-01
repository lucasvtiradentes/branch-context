from __future__ import annotations

import sys

from branchctx.constants import CLI_NAME
from branchctx.core.context_tags import update_context_tags
from branchctx.core.hooks import get_current_branch, get_git_root
from branchctx.core.sync import get_branch_dir, reset_branch_context, sanitize_branch_name
from branchctx.data.branch_base import get_base_branch
from branchctx.data.config import config_exists, list_templates


def _select_template(templates: list[str]) -> str | None:
    print("Templates:\n")
    for i, t in enumerate(templates, 1):
        print(f"  {i}. {t}")

    print()
    try:
        choice = input("Select [1-{}, c=cancel]: ".format(len(templates))).strip()
        if not choice or choice.lower() in ("c", "cancel"):
            return None
        idx = int(choice) - 1
        if 0 <= idx < len(templates):
            return templates[idx]
        print("error: invalid selection")
        return None
    except ValueError:
        print("error: invalid input")
        return None
    except (EOFError, KeyboardInterrupt):
        print()
        return None


def cmd_template(args: list[str]) -> int:
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

    templates = list_templates(git_root)
    if not templates:
        print("error: no templates found")
        return 1

    if args:
        template = args[0]
    else:
        if not sys.stdin.isatty():
            print(f"usage: {CLI_NAME} template <name>")
            print(f"available: {', '.join(templates)}")
            return 1
        template = _select_template(templates)
        if not template:
            print("cancelled")
            return 1

    if template not in templates:
        print(f"error: template '{template}' not found")
        print(f"available: {', '.join(templates)}")
        return 1

    result = reset_branch_context(git_root, branch, template)

    if result == "template_not_found":
        print("error: template not found")
        return 1

    branch_key = sanitize_branch_name(branch)
    context_dir = get_branch_dir(git_root, branch)
    update_context_tags(git_root, context_dir, branch_key, get_base_branch(git_root, context_dir))

    print(f"Applied template '{template}' to '{branch}'")
    return 0
