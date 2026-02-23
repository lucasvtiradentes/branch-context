HOOK_NAME = "post-checkout"
HOOK_MARKER = "# omnicontext-managed"

CONFIG_DIR = ".omnicontext"
CONFIG_FILE = "config.json"
TEMPLATE_DIR = "template"
BRANCHES_DIR = "branches"

DEFAULT_TEMPLATE_CONTEXT = """# Branch Context

## Objective

N/A

## Notes

N/A

## Tasks

- [ ] TODO
"""

GITIGNORE_BRANCHES = """# Ignore all branch contexts (local only)
*
!.gitignore
"""

GITIGNORE_ROOT = """# Ignore branch data and secrets
branches/
*.json
!config.json
"""

HOOK_TEMPLATE = """#!/bin/bash
{marker}

PREV_HEAD="$1"
NEW_HEAD="$2"
CHECKOUT_TYPE="$3"

if [ "$CHECKOUT_TYPE" == "1" ]; then
    OLD_BRANCH=$(git rev-parse --abbrev-ref @{{-1}} 2>/dev/null || echo "unknown")
    NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    {callback} "$OLD_BRANCH" "$NEW_BRANCH" "$PREV_HEAD" "$NEW_HEAD"
fi
"""
