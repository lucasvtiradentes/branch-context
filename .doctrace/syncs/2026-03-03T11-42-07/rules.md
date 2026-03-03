# Sync Report: docs/rules.md

## Summary

3 factual issues found and fixed. All related to code examples and constant values that had drifted from the actual source code after refactoring.

## Sources Checked

- `src/branchctx/constants.py` - verified constant values
- `src/branchctx/utils/git.py` - verified `git_root` function signature and implementation
- `src/branchctx/core/sync.py` - verified `sync_branch` and `list_branches` signatures
- `src/branchctx/core/context_tags.py` - verified `TagUpdate` dataclass
- `src/branchctx/core/hooks.py` - verified `get_git_root` wrapper and command patterns
- `src/branchctx/commands/sync.py` - verified command handler pattern and error messages
- `src/branchctx/data/` - verified module exists with expected files
- `pyproject.toml` - verified ruff config (line-length=120, select=["E","F","I"])

## Related Docs Checked

- `docs/repo/structure.md` - consistent with rules.md File Organization section
- `docs/testing.md` - no conflicts with rules.md

## Changes Made

### Fix 1: `git_root` function signature and implementation (line 47)

The code example for `git_root` had an incorrect parameter name (`cwd` instead of `path`), the parameter was shown as optional (`str | None = None`) when it is required (`str`), the subprocess call used `check=False` logic (checking `returncode`) instead of `check=True` with exception handling, and the exception type was `Exception` instead of `subprocess.CalledProcessError`.

- **Before:** `def git_root(cwd: str | None = None) -> str | None:` with `if result.returncode == 0` pattern and `except Exception`
- **After:** `def git_root(path: str) -> str | None:` with `check=True` and `except subprocess.CalledProcessError`
- **Source:** `src/branchctx/utils/git.py` lines 56-67

### Fix 2: `CONTEXT_FILE_EXTENSIONS` constant value (line 90)

The value was listed as `(".md", ".yaml", ".yml", ".json", ".toml")` but the actual constant is `(".md", ".txt")`.

- **Before:** `CONTEXT_FILE_EXTENSIONS = (".md", ".yaml", ".yml", ".json", ".toml")`
- **After:** `CONTEXT_FILE_EXTENSIONS = (".md", ".txt")`
- **Source:** `src/branchctx/constants.py` line 25

### Fix 3: `TEMPLATE_FILE_EXTENSIONS` constant value (line 91)

The value was listed as `(".md", ".yaml", ".yml", ".json", ".toml")` but the actual constant includes `.txt` as well: `(".md", ".txt", ".json", ".yaml", ".yml", ".toml")`.

- **Before:** `TEMPLATE_FILE_EXTENSIONS = (".md", ".yaml", ".yml", ".json", ".toml")`
- **After:** `TEMPLATE_FILE_EXTENSIONS = (".md", ".txt", ".json", ".yaml", ".yml", ".toml")`
- **Source:** `src/branchctx/constants.py` line 24

### Fix 4: `sync_branch` return type annotation (line 69)

The return type was shown as `dict[str, str]` but the actual function returns `dict` (unparameterized).

- **Before:** `def sync_branch(workspace: str, branch: str) -> dict[str, str]:`
- **After:** `def sync_branch(workspace: str, branch: str) -> dict:`
- **Source:** `src/branchctx/core/sync.py` line 173

## Verified Accurate (No Changes Needed)

- `TagUpdate` dataclass fields match `src/branchctx/core/context_tags.py` exactly
- Import example pattern (`from __future__ import annotations`, stdlib, then package) matches actual code
- `list_branches` signature `(workspace: str) -> list[str]` matches `src/branchctx/core/sync.py` line 191
- Ruff config (E, F, I rules; 120 char line length) matches `pyproject.toml`
- Command handler pattern (`cmd_sync(_args: list[str]) -> int`) matches actual commands
- Error message prefixes ("error: ...") match actual usage in `src/branchctx/commands/sync.py`
- Anti-pattern imports (`branchctx.utils.git`, `branchctx.constants`) are valid paths
- File Organization section accurately describes `commands/`, `core/`, `data/`, `utils/`, `assets/`
- Frontmatter sources and related_docs are accurate

## Frontmatter

No changes needed. The source `src/branchctx/` correctly covers all code referenced in the doc.
