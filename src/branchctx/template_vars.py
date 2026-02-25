from __future__ import annotations

import re
from datetime import datetime

from branchctx.git import git_user_name

VAR_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def get_template_variables(branch: str) -> dict[str, str]:
    return {
        "branch": branch,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "author": git_user_name(),
    }


def render_template_content(content: str, variables: dict[str, str]) -> str:
    def replacer(match: re.Match) -> str:
        var_name = match.group(1)
        return variables.get(var_name, match.group(0))

    return VAR_PATTERN.sub(replacer, content)
