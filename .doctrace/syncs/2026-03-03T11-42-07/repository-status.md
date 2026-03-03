# Sync Report: docs/features/repository-status.md

## Summary

No changes required. The documentation accurately reflects the current source code.

## Sources Reviewed

- `src/branchctx/commands/status.py` (primary source, listed in frontmatter)
- `src/branchctx/constants.py` (constants used by status command)
- `src/branchctx/core/hooks.py` (is_hook_installed, get_current_branch)
- `src/branchctx/data/config.py` (config_exists, get_templates_dir, list_templates)
- `src/branchctx/utils/git.py` (git_config_get, git_list_branches)
- `src/branchctx/data/branch_base.py` (get_base_branch)
- `src/branchctx/core/sync.py` (get_branch_dir, list_branches, sanitize_branch_name)

## Related Docs Reviewed

- `docs/features/branch-context-management.md` - exists, referenced correctly
- `docs/features/shell-integration.md` - exists, referenced correctly

## Verification Details

| Doc Claim | Source Reference | Status |
|---|---|---|
| Command: `bctx status` | `cmd_status` in status.py | correct |
| Output field: `Repository:` | status.py:35 | correct |
| Output field: `Branch:` | status.py:36 | correct |
| Output field: `Symlink: _branch -> ...` | status.py:38, DEFAULT_SYMLINK="_branch" | correct |
| Output field: `Hooks:` | status.py:47 | correct |
| Output field: `Templates:` | status.py:50 | correct |
| Output field: `Contexts: N branches` | status.py:53 | correct |
| Output field: `Base:` | status.py:55 | correct |
| Indicator `[ok]` | STATUS_OK = "[ok]" | correct |
| Indicator `[!!]` | STATUS_ERROR = "[!!]" | correct |
| Indicator `[--]` | STATUS_WARN = "[--]" | correct |
| Hook check uses bctx marker | is_hook_installed checks HOOK_MARKER | correct |
| Templates dir check | status.py:80-84 | correct |
| _default template check | status.py:86-90 | correct |
| Symlink validity logic | status.py:92-103 | correct |
| Orphan contexts check | status.py:105-114 | correct |
| Exit code 0 = all passed | status.py:118 returns 0 | correct |
| Exit code 1 = errors exist | status.py:117 returns 1 if issues | correct |
| Warnings don't affect exit | warnings list unused for return | correct |
| Global hooks path display | status.py:57-59, git_config_get scope="global" | correct |

## Frontmatter Validation

- `sources`: `src/branchctx/commands/status.py` -- correct path, file exists
- `related_docs`: both referenced docs exist and are relevant
- `required_docs`: empty, appropriate for this standalone feature doc

## Changes Applied

None.
