# Sync Report: docs/repo/structure.md

**Date:** 2026-03-03
**Status:** Updated

## Sources Checked

- `src/branchctx/` - full directory listing compared against doc tree
- `tests/` - full directory listing compared against doc tree
- `docs/architecture.md` - read as related doc
- `docs/repo/tooling.md` - read as related doc

## Issues Found

### 1. Incorrect asset directory name (FIXED)

- **Location:** Line 50, assets tree listing
- **Problem:** Doc listed `init_templates/` with description "Default templates", but the actual directory is `init/` which contains templates plus other init assets (config.json, hook scripts).
- **Fix:** Changed `init_templates/ Default templates` to `init/            Init assets and default templates`

### 2. Incorrect notification sound filename (FIXED)

- **Location:** Line 51, assets tree listing
- **Problem:** Doc listed `switch.wav` but the actual file is `notification.oga`.
- **Fix:** Changed `switch.wav      Notification sound` to `notification.oga Notification sound`

## Verified Correct (no changes needed)

- **Package submodules:** `core/`, `data/`, `utils/` listings all match actual filesystem
- **Commands directory:** All 9 command files listed match actual files exactly
- **Core directory:** `hooks.py`, `sync.py`, `context_tags.py` all present
- **Data directory:** `config.py`, `meta.py`, `branch_base.py` all present
- **Utils directory:** `git.py`, `template.py` all present
- **Tests directory:** All integration and e2e test files listed match actual filesystem
- **Key Directories table:** All entries are accurate
- **Top-level files:** `pyproject.toml`, `Makefile`, `README.md` all present
- **No `on_switch` references:** Doc correctly omits the removed feature
- **Symlink name:** Not referenced in this doc (correctly handled in architecture.md)
- **Frontmatter sources:** Correctly lists `src/branchctx/` and `tests/`

## Notes

- The `__init__.py` files in `core/`, `data/`, `utils/`, and `commands/` are not listed in the tree. This appears to be an intentional style choice for brevity (only `assets/__init__.py` is listed because it contains substantive helper functions). No change made.
- `src/branchctx/py.typed` exists but is not listed in the tree. This predates the recent changes and is a style choice. No change made.
- Both fixed issues predate the commits in range -- they were pre-existing doc errors, not caused by the recent refactoring. However, they are factual inaccuracies that contradict the source code.
