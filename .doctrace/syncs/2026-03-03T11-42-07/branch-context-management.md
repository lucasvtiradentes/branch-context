# Sync Report: branch-context-management.md

**Date:** 2026-03-03
**Doc:** docs/features/branch-context-management.md
**Status:** UPDATED

## Sources Checked

- src/branchctx/commands/init.py
- src/branchctx/commands/branches.py
- src/branchctx/commands/sync.py
- src/branchctx/commands/template.py
- src/branchctx/core/sync.py
- src/branchctx/data/config.py (template_rules format, Config class)
- src/branchctx/data/branch_base.py (base branch resolution)
- src/branchctx/utils/template.py (template variable definitions)
- src/branchctx/constants.py (ARCHIVED_DIR, DEFAULT_SYMLINK, etc.)
- src/branchctx/assets/init/config.json (default config structure)

## Changes Made

### 1. Fixed template_rules config format (FACTUAL ERROR)

**Location:** Lines 96-104 (Template Rules section)

**Before:**
```json
{
  "template_rules": {
    "feature/": "feature",
    "fix/": "fix",
    "hotfix/": "fix"
  }
}
```

**After:**
```json
{
  "template_rules": [
    {"prefix": "feature/", "template": "feature"},
    {"prefix": "fix/", "template": "fix"},
    {"prefix": "hotfix/", "template": "fix"}
  ]
}
```

**Reason:** The actual config format uses an array of `{"prefix": ..., "template": ...}` objects, not a flat dict. This is confirmed by `Config.save()` in `src/branchctx/data/config.py` (line 76), `Config.load()` (line 61-63), and the default config at `src/branchctx/assets/init/config.json`.

### 2. Fixed template variables in Sync Flow diagram (FACTUAL ERROR)

**Location:** Lines 151-152 (Sync Flow diagram, step 3)

**Before:**
```
│     │ {{BRANCH}}     │───→│ feature/auth    │
│     │ {{BASE}}       │───→│ main            │
```

**After:**
```
│     │ {{branch}}     │───→│ feature/auth    │
│     │ {{date}}       │───→│ 2024-01-15      │
```

**Reason:** `src/branchctx/utils/template.py` defines template variables as lowercase keys: `branch`, `date`, `author`. The variable `{{BASE}}` does not exist in the template variable system. The regex pattern (`\{\{(\w+)\}\}`) and dict lookup are case-sensitive, so `{{BRANCH}}` would not match the `branch` key.

### 3. Fixed archive path in prune diagram (FACTUAL ERROR)

**Location:** Lines 73-76 (Prune Orphan Contexts diagram)

**Before:**
```
│ .bctx/archived/ │
│ deleted-branch/ │
```

**After:**
```
│ .bctx/branches/_archived/│
│ deleted-branch/           │
```

**Reason:** `get_archived_dir()` in `src/branchctx/core/sync.py` (line 203-204) returns `get_branches_dir(workspace) + ARCHIVED_DIR`, which resolves to `.bctx/branches/_archived/`. The archived directory is a subdirectory of `branches/`, not a sibling. The constant `ARCHIVED_DIR = "_archived"` is defined in `src/branchctx/constants.py`.

## Verified Accurate (No Changes Needed)

- **Init command outputs:** Directory structure, hooks installed, symlink created all match `cmd_init` in init.py
- **Branches list output format:** Matches `_cmd_list` in branches.py (marker format, file count, archived count)
- **Branches prune behavior:** Correctly described as archiving orphan contexts
- **Template table:** Lists `_default`, `feature`, `fix`, `(custom)` as example templates; while only `_default` and `feature` ship by default, the table is illustrative and not misleading
- **Template apply commands:** Both interactive (`bctx template`) and direct (`bctx template feature`) match template.py
- **Manual sync steps:** All four steps (create context, update symlink, update meta, refresh tags) match `cmd_sync` in sync.py
- **Sync Flow diagram structure:** Steps 1, 2, 4 are accurate; step 3 was fixed above
- **Frontmatter sources:** All source paths are correct (files exist at listed paths)
- **Frontmatter related_docs and required_docs:** All referenced docs exist

## Notes

- The related doc `docs/features/context-metadata.md` also lists template variables as uppercase (`{{BRANCH}}`, `{{BASE}}`, `{{BRANCH_SCOPE}}`, `{{DATE}}`). That doc should be updated separately to match the actual lowercase variable names and correct set (`branch`, `date`, `author`).
