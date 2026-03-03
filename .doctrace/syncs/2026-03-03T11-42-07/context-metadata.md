# Sync Report: context-metadata.md

**Date:** 2026-03-03
**Doc:** docs/features/context-metadata.md
**Status:** UPDATED

## Sources Checked

- src/branchctx/data/meta.py
- src/branchctx/data/branch_base.py
- src/branchctx/core/context_tags.py
- src/branchctx/constants.py (supporting)
- src/branchctx/data/config.py (supporting)
- src/branchctx/utils/template.py (supporting)
- src/branchctx/core/sync.py (supporting)
- src/branchctx/commands/on_commit.py (supporting)
- src/branchctx/commands/on_checkout.py (supporting)
- src/branchctx/assets/init/templates/_default/context.md (supporting)

## Related/Required Docs Checked

- docs/overview.md - consistent with changes
- docs/features/branch-context-management.md - consistent with changes
- docs/features/shell-integration.md - consistent with changes

## Issues Found and Fixed

### 1. Wrong meta.json storage path
- **Location:** Line 19
- **Error:** Stated `.bctx/meta.json`
- **Fix:** Changed to `.bctx/branches/meta.json`
- **Source:** `meta.py:_get_meta_path()` returns `get_branches_dir(workspace) + META_FILE`, where `get_branches_dir` returns `{workspace}/.bctx/branches`

### 2. Wrong meta.json fields in example JSON
- **Location:** Lines 22-32 (example JSON block)
- **Error:** Showed `base_branch` and `last_sync` as meta fields. These do not exist in the meta schema.
- **Fix:** Replaced with actual fields from `create_branch_meta()`: `branch`, `created_at`, `author`, `updated_at`, `last_commit`, `commits`, `changed_files`
- **Source:** `meta.py:create_branch_meta()` (lines 151-165) and `update_branch_meta()` (lines 168-183)

### 3. Wrong meta fields table
- **Location:** Lines 34-39 (Meta Fields table)
- **Error:** Listed `base_branch` (string) and `last_sync` (datetime). These fields do not exist in meta.json.
- **Fix:** Replaced with actual fields: `branch`, `created_at`, `author`, `updated_at`, `last_commit`, `commits`, `changed_files`
- **Source:** `meta.py:create_branch_meta()` and `update_branch_meta()`

### 4. Wrong context file extensions in Tag Update Flow
- **Location:** Line 91 (inside diagram)
- **Error:** Listed `.md, .yaml, .json, .toml`
- **Fix:** Changed to `.md, .txt`
- **Source:** `constants.py:CONTEXT_FILE_EXTENSIONS = (".md", ".txt")`

### 5. Wrong git diff notation in Update Flow diagram
- **Location:** Line 58 (inside diagram)
- **Error:** `git diff base..HEAD` (two dots)
- **Fix:** Changed to `git diff base...HEAD` (three dots)
- **Source:** `meta.py:_get_changed_files()` uses `f"{base_branch}...HEAD"` (line 71)

### 6. Wrong git diff notation in Tag Update Flow diagram
- **Location:** Line 113 (inside diagram)
- **Error:** `files -> git diff base..HEAD` (two dots)
- **Fix:** Changed to `files -> git diff base...HEAD` (three dots)
- **Source:** Same as above -- tags get their data from meta, which uses three-dot diff

### 7. Wrong base branch fallback
- **Location:** Line 120
- **Error:** `origin/main` or `origin/master`
- **Fix:** Changed to just `origin/main`
- **Source:** `constants.py:DEFAULT_BASE_BRANCH = "origin/main"` -- no `origin/master` fallback exists in `branch_base.py:get_base_branch()` or `_get_config_default_base_branch()`

### 8. Wrong template variables
- **Location:** Lines 159-164 (Template Variables table)
- **Error:** Listed `{{BRANCH}}`, `{{BASE}}`, `{{BRANCH_SCOPE}}`, `{{DATE}}` (uppercase, wrong set)
- **Fix:** Changed to `{{branch}}`, `{{date}}`, `{{author}}` (lowercase, actual variables)
- **Source:** `utils/template.py:get_template_variables()` returns `{"branch": ..., "date": ..., "author": ...}`. No `BASE` or `BRANCH_SCOPE` variables exist.

### 9. Missing .txt in supported template file types
- **Location:** Line 166
- **Error:** Listed `.md, .yaml, .yml, .json, .toml` (missing `.txt`)
- **Fix:** Changed to `.md, .txt, .json, .yaml, .yml, .toml`
- **Source:** `constants.py:TEMPLATE_FILE_EXTENSIONS = (".md", ".txt", ".json", ".yaml", ".yml", ".toml")`

## Frontmatter

No changes needed. Sources, related_docs, and required_docs are all accurate and reference valid paths.

## Items Not Changed

- Update Flow diagram structure (git checkout / git commit triggering update_branch_meta) -- verified accurate against on_checkout.py and on_commit.py
- Context Tags section (tag names, regex pattern, example) -- verified accurate against context_tags.py
- Base Branch resolution flow diagram -- verified accurate against branch_base.py:get_base_branch()
- Per-branch override example path -- verified accurate
