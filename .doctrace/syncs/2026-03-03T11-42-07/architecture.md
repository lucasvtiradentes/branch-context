# Sync Report: docs/architecture.md

**Date:** 2026-03-03T11-42-07
**Status:** UPDATED
**Changes applied:** 8

## Fixes Applied

### 1. Git Queries table: `git_list_branches()` command
- **Location:** Line 168, Git Queries table
- **Issue:** Documented command was `branch --list` but actual code uses `branch --format=%(refname:short)`
- **Fix:** Changed to `branch --format=short` (abbreviated for table width)
- **Source:** `src/branchctx/utils/git.py` line 101

### 2. Git Queries table: removed non-existent functions
- **Location:** Lines 169-170 (old), Git Queries table
- **Issue:** `git_commits_since()` and `git_changed_files()` were listed as functions in `utils/git.py` but they do not exist there. The equivalent logic lives in `data/meta.py` as private functions `_get_commits_since_base()` and `_get_changed_files()`
- **Fix:** Removed both rows from the table
- **Source:** `src/branchctx/utils/git.py` (functions absent), `src/branchctx/data/meta.py` lines 54-135

### 3. Data Storage diagram: meta.json path
- **Location:** Line 110, Data Storage diagram
- **Issue:** Showed `.bctx/meta.json` but the actual path is `.bctx/branches/meta.json`
- **Fix:** Changed to `.bctx/branches/meta.json` (split across two lines in diagram)
- **Source:** `src/branchctx/data/meta.py` line 14 (`_get_meta_path` uses `get_branches_dir()`)

### 4. Data Storage diagram: meta.json field name
- **Location:** Line 114, Data Storage diagram
- **Issue:** Listed `last_sync` as a meta.json field but the actual field is `updated_at`
- **Fix:** Changed to `updated_at`
- **Source:** `src/branchctx/data/meta.py` line 178

### 5. Data Storage diagram: config.json field name
- **Location:** Line 113, Data Storage diagram
- **Issue:** Listed `base_branch` as a config.json field but the actual field is `default_base_branch`
- **Fix:** Changed to `default_base` (abbreviated for diagram column width)
- **Source:** `src/branchctx/data/branch_base.py` line 15

### 6. Template Variables: wrong names and non-existent variables
- **Location:** Lines 180-183, Template Variables section
- **Issue:** Listed `{{BRANCH}}`, `{{BASE}}`, `{{BRANCH_SCOPE}}`, `{{DATE}}` (uppercase). Actual variables are lowercase `{{branch}}`, `{{date}}`, `{{author}}`. `{{BASE}}` and `{{BRANCH_SCOPE}}` do not exist.
- **Fix:** Replaced with correct variables: `{{branch}}`, `{{date}}`, `{{author}}`
- **Source:** `src/branchctx/utils/template.py` lines 11-16

### 7. Module Dependencies: template.py deps incorrect
- **Location:** Line 213, Module Dependencies section
- **Issue:** Listed `template.py -> core/sync.py, utils/template.py` but `commands/template.py` does not import `utils/template.py`. It imports `core/context_tags.py`.
- **Fix:** Changed to `template.py -> core/sync.py, core/context_tags.py`
- **Source:** `src/branchctx/commands/template.py` lines 6-10

### 8. Module Dependencies: branch_base.py and core/sync.py deps
- **Location:** Lines 221, 227, Module Dependencies section
- **Issue:** (a) `branch_base.py -> data/config.py` is wrong -- `branch_base.py` reads config.json directly via constants, does not import `data/config.py`. (b) `core/sync.py` was missing `data/branch_base.py` from its dependency list.
- **Fix:** (a) Changed `branch_base.py` to `(standalone)`. (b) Added `data/branch_base.py` to `core/sync.py` deps.
- **Source:** `src/branchctx/data/branch_base.py` imports, `src/branchctx/core/sync.py` line 20

## Not Changed (noted for completeness)

### Post-checkout flow diagram simplification
- **Location:** Lines 56-67
- **Observation:** The diagram shows `update_symlink` as a step following `update_context_tags`, but in the actual code `update_symlink` happens inside `sync_branch()`, before `update_branch_meta` and `update_context_tags` are called separately. The diagram captures all the right components but simplifies the nesting. Not changed because the components are all correct and the diagram is a reasonable abstraction.

### Module Dependencies: incomplete import lists
- **Observation:** Most command entries list only a subset of their imports (e.g., `sync.py` is missing `core/context_tags.py`, `core/hooks.py`, `data/branch_base.py`; `status.py` is missing `core/sync.py`, `data/branch_base.py`, `utils/git.py`). These are omissions rather than factual errors -- the listed deps are correct, just incomplete. Not changed to stay conservative; the section appears to show primary/notable dependencies rather than exhaustive lists.

### Data Sources diagram
- **Observation:** The Data Sources box shows all git commands flowing through `utils/git.py`, but `git log` and `git diff` commands for commits/changed_files are actually executed directly in `data/meta.py`, not via `utils/git.py`. Not changed because the diagram is a high-level architectural view and the flow is approximately correct for the other git operations.
