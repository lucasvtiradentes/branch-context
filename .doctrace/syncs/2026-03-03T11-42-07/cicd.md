# Sync Report: docs/repo/cicd.md

## Summary

3 issues found, 3 fixes applied.

The doc was outdated due to new workflows added in recent commits (check-completion.yml renamed from what the doc listed, and update-docs.yml added). All fixes are factual corrections only.

## Sources Checked

- `.github/workflows/callable-ci.yml` -- verified against CI Checks section
- `.github/workflows/prs.yml` -- verified trigger and callable reference
- `.github/workflows/push-to-main.yml` -- verified trigger and callable reference
- `.github/workflows/release.yml` -- verified against Release Pipeline section
- `.github/workflows/check-completion.yml` -- **new file** (commit 8b5f6d2), was listed with wrong filename in doc
- `.github/workflows/update-docs.yml` -- **new file** (commit 894e36f), was missing from doc entirely
- `docs/repo/tooling.md` -- related doc, no cross-reference issues
- `docs/testing.md` -- related doc, no cross-reference issues

## Issues and Fixes

### Issue 1: Wrong workflow filename in Pipelines diagram

- **Type**: Factual error
- **Location**: Line 27 (Pipelines diagram)
- **Problem**: Doc referenced `check-completion-sync.yml` but the actual file is `check-completion.yml`
- **Evidence**: The file `.github/workflows/check-completion.yml` exists; no file named `check-completion-sync.yml` exists. The workflow's internal name is "Check Completion Sync" but the filename does not include "-sync".
- **Fix**: Changed `check-completion-sync.yml` to `check-completion.yml`

### Issue 2: Missing update-docs.yml workflow from Pipelines diagram

- **Type**: Missing content (new workflow)
- **Location**: After line 27 (Pipelines diagram)
- **Problem**: The `update-docs.yml` workflow was added in commit 894e36f but not documented in the Pipelines diagram
- **Evidence**: `.github/workflows/update-docs.yml` exists with a daily schedule (`cron: "0 0 * * *"`) and manual trigger
- **Fix**: Added `Daily ──> update-docs.yml` entry to the Pipelines diagram

### Issue 3: Incomplete secret usage in Secrets table

- **Type**: Factual error (incomplete)
- **Location**: Line 78 (Secrets table)
- **Problem**: `CLAUDE_CODE_OAUTH_TOKEN` was listed as used only by `check-completion`, but `update-docs.yml` also passes this secret
- **Evidence**: `update-docs.yml` line 25: `CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`
- **Fix**: Updated "Used By" column from `check-completion` to `check-completion, update-docs`

## Verified Sections (No Changes Needed)

- **CI Checks (callable-ci.yml)**: All three jobs (check, integration, e2e) accurately reflect the workflow file -- runners, python versions, matrix strategies, and steps all match.
- **Release Pipeline (release.yml)**: Trigger type, version bump input options, and pipeline flow diagram all match the workflow file.
- **Branch Strategy**: Accurate representation of the workflow.
- **Frontmatter**: Sources list `.github/workflows/` which covers all workflow files. Related docs are valid. No changes needed.
