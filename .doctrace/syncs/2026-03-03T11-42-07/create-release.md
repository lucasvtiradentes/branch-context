# Sync Report: docs/guides/create-release.md

**Date**: 2026-03-03
**Triggered by**: changes to `.bumpversion.cfg`, `pyproject.toml`
**Commits in range**: e3cc114, fdf83be, 73e2652, 563b158, 9c654d4

## Changes Applied

### 1. Added missing `initial` bump type option

- **Location**: Release Flow diagram (line 53-54) and Commands section (line 79)
- **Issue**: Doc listed only `patch / minor / major` but `.github/workflows/release.yml` defines four options: `patch`, `minor`, `major`, `initial`. The `initial` option skips the bump2version step and is used for first-time releases.
- **Fix**: Added `initial` to both the diagram and the instructions.

### 2. Added missing `hatch build` workflow step

- **Location**: Release Flow diagram, Workflow actions list (line 62)
- **Issue**: The workflow actions listed "bump version, towncrier build, publish to PyPI, commit + tag" but the actual `release.yml` has a `hatch build` step between towncrier build and PyPI publish (line 51-52 of release.yml). Without this step, the package artifacts would not exist for the publish step.
- **Fix**: Added `- hatch build` between `- towncrier build` and `- publish to PyPI`.

## No Changes Needed

- **Frontmatter**: All sources, related_docs are accurate and point to existing files.
- **Tools section**: `towncrier` and `bump2version` are both used in the workflow and listed in dev dependencies.
- **Changelog Fragments section**: Fragment naming convention `.changelog/+<name>.<type>.md` matches actual usage (verified from git history of deleted fragments). The three types (`feature`, `bugfix`, `misc`) match the `[[tool.towncrier.type]]` entries in `pyproject.toml`.
- **Commands section**: `make changelog-draft` target exists in the Makefile and works as described.
- **Version numbers**: The doc does not reference any specific version, so the version bumps from 0.2.0 to 0.2.3 do not affect it.

## Sources Reviewed

| Source | Status |
|--------|--------|
| `.github/workflows/release.yml` | 2 discrepancies found and fixed |
| `.changelog/` | Consistent with doc |
| `pyproject.toml` | Consistent with doc |
| `.bumpversion.cfg` | Consistent with doc |
| `Makefile` | Consistent with doc |
| `docs/repo/cicd.md` | Consistent (related doc) |
| `docs/repo/tooling.md` | Consistent (related doc) |
