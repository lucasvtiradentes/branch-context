# Sync Report: docs/features/shell-integration.md

**Date:** 2026-03-03T11:42:07
**Status:** UPDATED

## Sources Checked

- src/branchctx/commands/completion.py
- src/branchctx/commands/on_checkout.py
- src/branchctx/commands/on_commit.py
- src/branchctx/core/hooks.py
- src/branchctx/core/sync.py
- src/branchctx/constants.py (additional)
- src/branchctx/data/config.py (additional)
- src/branchctx/assets/init/hook_post_checkout.sh (additional)
- src/branchctx/assets/init/hook_post_commit.sh (additional)
- src/branchctx/assets/init/config.json (additional)

## Related/Required Docs Checked

- docs/features/branch-context-management.md
- docs/overview.md

## Issues Found and Fixed

### 1. Hook content: wrong marker, wrong shell, missing CHECKOUT_TYPE logic

**Section:** Hook Content (was lines 110-116)
**Problem:** The documented generated hook script showed `#!/bin/sh` with marker `# branch-ctx` and a simple invocation. The actual template (`hook_post_checkout.sh`) uses `#!/bin/bash`, marker `# branch-ctx-managed` (from `HOOK_MARKER` constant in `constants.py`), includes `CHECKOUT_TYPE` guard logic, and passes `$PREV_HEAD` and `$NEW_HEAD` as additional arguments.
**Fix:** Replaced the entire hook script block with the actual template content (with `{marker}` and `{callback}` placeholders resolved).

### 2. Append mode snippet: wrong marker

**Section:** Append Mode (was lines 126-131)
**Problem:** The append snippet showed `# branch-ctx` as the start marker. The actual `_get_append_snippet()` in `hooks.py` uses `HOOK_MARKER` which is `# branch-ctx-managed`.
**Fix:** Changed `# branch-ctx` to `# branch-ctx-managed` in the append snippet.

### 3. Sound config field name: `sound_enabled` vs `sound`

**Section:** Sound Notification > Configuration (was lines 139-149)
**Problem:** The doc showed config field `"sound_enabled": true` but the actual config field is `"sound"` (see `Config` dataclass in `data/config.py`, default config asset `config.json`, and `sync_branch()` which checks `config.sound`).
**Fix:** Changed `"sound_enabled"` to `"sound"` in both the JSON example and the field description table.

### 4. Default sound file: wrong filename and format

**Section:** Sound Notification (was line 159)
**Problem:** The doc stated the default sound is bundled at `src/branchctx/assets/switch.wav`. The actual file is `notification.oga` (from `DEFAULT_SOUND_FILE = "notification.oga"` in `constants.py`, confirmed by file listing).
**Fix:** Changed path to `src/branchctx/assets/notification.oga`.

## Verified Accurate (No Changes Needed)

- **Shell Completions section:** Generate/install commands and completion features table all match `completion.py`
- **Post-Checkout Hook actions:** Accurate simplification of `cmd_on_checkout` flow (sync_branch -> update_branch_meta -> update_context_tags)
- **Post-Commit Hook actions:** Matches `cmd_on_commit` flow
- **Hook Locations:** Standard, custom (core.hooksPath), and Husky paths match `get_hook_path()` and `_get_husky_user_hooks_dir()` in hooks.py
- **Platform Support table:** afplay/paplay/PowerShell matches `play_sound()` in sync.py
- **Frontmatter metadata:** All source paths are correct; related_docs references are valid
