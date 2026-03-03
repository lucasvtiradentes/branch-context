# Sync Report: docs/repo/tooling.md

## Summary

No changes needed. The documentation is accurate against all source files.

## Sources Checked

| Source | Status |
|---|---|
| pyproject.toml | verified |
| Makefile | verified |
| .pre-commit-config.yaml | verified |
| .bumpversion.cfg | verified (referenced in doc) |

## Related Docs Checked

| Doc | Status |
|---|---|
| docs/repo/local-setup.md | consistent |
| docs/repo/cicd.md | consistent |

## Git Context

The only change to the flagged source (`pyproject.toml`) since docs-base was a version bump from `0.1.10` to `0.2.3`. The doc does not reference any specific version number, so no update is needed.

Other commits in range added `check-completion-sync.yml` and `.claude/commands/check-completion-sync.md`, which are not within the scope of this doc (they relate to CI/CD, covered by `docs/repo/cicd.md`).

## Verification Details

- **Build System table**: hatchling and pip entries match pyproject.toml
- **Code Quality table**: ruff and pre-commit entries match pyproject.toml and .pre-commit-config.yaml
- **Ruff Configuration block**: `line-length = 120` and `select = ["E", "F", "I"]` match pyproject.toml exactly
- **Rules list**: E (pycodestyle), F (pyflakes), I (isort) descriptions are correct
- **Testing table**: pytest config and `tests/` path match pyproject.toml `[tool.pytest.ini_options]`
- **Version Management table**: bump2version in .bumpversion.cfg and towncrier in pyproject.toml both confirmed
- **Towncrier Configuration**: `.changelog/` directory and subdirectory types (feature, bugfix, misc) match pyproject.toml `[[tool.towncrier.type]]` entries
- **Python Support**: versions 3.9-3.14 match pyproject.toml classifiers
- **Makefile Targets**: all 7 listed targets (install, check, format, test, build, changelog, clean) match Makefile commands and descriptions

## Notes

- The Makefile also contains targets `test-install`, `test-uninstall`, `test-status`, and `changelog-draft` that are not listed in the doc. These are pre-existing omissions, not regressions from recent changes. Not modifying per conservative editing rules.
- The `.changelog/` directory currently only contains a `.gitkeep` file. The doc shows example filenames (123.md, 456.md, 789.md) which are illustrative, not claims about existing files. This is acceptable.

## Changes Applied

None.
