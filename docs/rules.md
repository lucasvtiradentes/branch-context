---
title: Rules
description: Coding principles, conventions, and anti-patterns
related_docs:
  - docs/repo/structure.md: codebase organization
  - docs/testing.md:        testing patterns
required_docs: []
sources:
  - src/branchctx/:           codebase for examples
---

# Rules

## Principles

### Use Dataclasses for Data Structures

```python
from dataclasses import dataclass

@dataclass
class TagUpdate:
    file: str
    tag: str
    old_content: str
    new_content: str
```

### Import All Dependencies Upfront

```python
from __future__ import annotations

import os
import re
from typing import Literal

from branchctx.constants import ...
from branchctx.data.config import ...
```

### Wrapped Subprocess Calls

All git operations go through `utils/git.py`:

```python
def git_root(path: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=path,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None
```

## Conventions

### Type Hints Required

Python 3.9+ style:

```python
def sync_branch(workspace: str, branch: str) -> dict:
    ...

def list_branches(workspace: str) -> list[str]:
    ...
```

### Ruff Lint Rules

Enforced rules: E, F, I

- E: pycodestyle errors
- F: pyflakes (undefined names, unused imports)
- I: isort (import sorting)

Line length: 120 characters

### File Extensions as Constants

```python
# constants.py
CONTEXT_FILE_EXTENSIONS = (".md", ".txt")
TEMPLATE_FILE_EXTENSIONS = (".md", ".txt", ".json", ".yaml", ".yml", ".toml")
```

### Command Handler Pattern

Each command returns exit code:

```python
def cmd_sync(_args: list[str]) -> int:
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    # ... logic ...

    return 0
```

### Error Messages

Prefix with "error:" for consistency:

```python
print("error: not a git repository")
print("error: not initialized. Run 'bctx init' first")
print(f"error: unknown command '{cmd}'")
```

## Anti-Patterns

### Avoid Direct Git Operations

Bad:
```python
os.system("git rev-parse --show-toplevel")
```

Good:
```python
from branchctx.utils.git import git_root
root = git_root()
```

### Do Not Hardcode Paths

Bad:
```python
config_path = ".bctx/config.json"
```

Good:
```python
from branchctx.constants import CONFIG_DIR, CONFIG_FILE
config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)
```

### Avoid Bare Exceptions

Bad:
```python
try:
    ...
except:
    pass
```

Good:
```python
try:
    ...
except (OSError, IOError):
    return None
```

### Do Not Assume Working Directory

Bad:
```python
with open("config.json") as f:
    ...
```

Good:
```python
config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)
with open(config_path) as f:
    ...
```

## File Organization

```
commands/     One file per CLI command
core/         Business logic (no I/O with user)
data/         JSON file operations
utils/        Generic utilities (git, template)
assets/       Static files
```
