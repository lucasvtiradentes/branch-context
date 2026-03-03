# Sync Report: docs/repo/local-setup.md

## Summary

No changes needed. The document is fully accurate against the current source code.

## Trigger Analysis

The doc was flagged because `pyproject.toml` changed. The only change was a version bump (to 0.2.3) across commits e3cc114, fdf83be, 73e2652, and 563b158. The local-setup doc does not reference any specific version number, so this change has no impact.

## Verification Details

| Doc Claim | Source | Status |
|-----------|--------|--------|
| Python 3.9+ prerequisite | pyproject.toml `requires-python = ">=3.9"` | Correct |
| `make install` creates venv, installs editable + dev, installs pre-commit | Makefile `install` target | Correct |
| Manual install commands match Makefile | Makefile lines 2-4 | Correct |
| Dev deps: pytest, ruff, towncrier, bump2version, pre-commit | pyproject.toml `[project.optional-dependencies]` | Correct |
| `make format` runs `ruff check --fix` + `ruff format` | Makefile `format` target | Correct |
| `make check` runs `ruff check` + `ruff format --check` | Makefile `check` target | Correct |
| `make test` runs `pytest -v` | Makefile `test` target | Correct |
| CLI entry point `bctx` exists | pyproject.toml `[project.scripts]` | Correct |
| Project structure: `.venv/`, `src/branchctx/` | pyproject.toml, Makefile | Correct |

## Related Docs Check

- `docs/repo/tooling.md`: exists, consistent with local-setup content
- `docs/testing.md`: exists, consistent with local-setup content

## Changes Applied

None.
