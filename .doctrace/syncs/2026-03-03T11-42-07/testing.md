# Sync Report: docs/testing.md

## Status: UPDATED

## Summary
One factual fix applied. The "Git Repository Setup" pattern showed a standalone function using raw `subprocess.run` calls, but actual tests use `git_init` and `git_config` from `branchctx.utils.git`. All other content verified as accurate.

## Changes Applied

### 1. Fix Git Repository Setup pattern (lines 78-84)
- **What was wrong:** The pattern showed a `create_git_repo` function using raw `subprocess.run(["git", "init"], ...)` and `subprocess.run(["git", "config", ...], ...)` calls. No test in the codebase uses this approach. All tests import and use `git_init` and `git_config` from `branchctx.utils.git`.
- **What was changed:** Updated the pattern to import from `branchctx.utils.git` and use `git_init(path, "main")` and `git_config(path, key, value)`, matching the actual test code throughout `tests/integration/` and `tests/e2e/`.
- **Evidence:** Every test file that sets up a git repo uses `from branchctx.utils.git import git_init, git_config` (see `test_e2e.py:10`, `test_meta.py:18`, `test_hooks.py` fixture, `test_init.py:6`, etc.). The parameter type was also corrected from `Path` to `str` to match the actual function signatures in `utils/git.py`.

## Verified As Accurate (No Changes Needed)

- **Test directory structure (lines 23-41):** All listed files and directories match the actual filesystem exactly.
- **Framework section (lines 18-19):** pytest 7+ is correct per `pyproject.toml` line 35 (`"pytest>=7"`). No external test dependencies beyond pytest is accurate.
- **Running Tests section (lines 46-59):** Commands match `callable-ci.yml` and `Makefile` usage.
- **Temporary Directory Fixture pattern (lines 65-73):** Matches patterns used in `test_init.py`, `test_git.py`, and other tests.
- **Integration Test Pattern (lines 89-101):** Illustrative pattern; `cmd_init([])` creates `.bctx/config.json` as verified in `commands/init.py`.
- **E2E Test Pattern (lines 107-123):** `cmd_on_checkout` exists and is used in `test_meta_e2e.py`. `_branch` symlink name is correct per `constants.py:19` (`DEFAULT_SYMLINK = "_branch"`). Branch directory name `feature-test` correctly reflects slash-to-dash sanitization.
- **Test Coverage table (lines 127-136):** All module paths (`core/hooks.py`, `core/sync.py`, `core/context_tags.py`, `data/config.py`, `data/meta.py`, `utils/git.py`) are correct after the `ac9a145` refactoring that reorganized into `core/data/utils` subdirectories.
- **CI Matrix (lines 139-145):** Python versions 3.9-3.13 for integration tests on Ubuntu, and Python 3.12 for e2e on Ubuntu/Windows/macOS all match `callable-ci.yml` exactly.

## Notes
- The Integration Test Pattern and E2E Test Pattern use `pathlib.Path` style (`workspace / ".bctx" / ...`) while actual tests use `os.path.join`. This is a style difference in illustrative examples, not a factual error about behavior. Not changed per conservative editing rules.
- The `on_switch` feature was removed (commit `08138c3`) but the doc did not reference it, so no change needed.
- The `base_branch` was moved to per-branch with config fallback (commit `f560b08`) but the doc does not discuss base_branch configuration, so no change needed.

## Sources Checked
- `tests/` - all test files in `integration/` and `e2e/`
- `tests/utils.py` - shared test utility
- `pyproject.toml` - pytest configuration and dev dependencies
- `src/branchctx/utils/git.py` - git utility functions used in tests
- `src/branchctx/constants.py` - constant values referenced in tests
- `src/branchctx/commands/init.py` - init command behavior
- `src/branchctx/commands/on_checkout.py` - on_checkout command
- `.github/workflows/callable-ci.yml` - CI matrix configuration
- `docs/repo/local-setup.md` - related doc (verified cross-references)
- `docs/repo/cicd.md` - related doc (verified cross-references)
