from __future__ import annotations

import re
import subprocess
from datetime import datetime

VAR_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def get_git_author() -> str:
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_template_variables(branch: str) -> dict[str, str]:
    return {
        "branch": branch,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "author": get_git_author(),
    }


def render_template_content(content: str, variables: dict[str, str]) -> str:
    def replacer(match: re.Match) -> str:
        var_name = match.group(1)
        return variables.get(var_name, match.group(0))

    return VAR_PATTERN.sub(replacer, content)
