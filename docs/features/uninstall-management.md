---
title: Uninstall Management
description: Removing git hooks and cleanup procedures
related_docs:
  - docs/features/shell-integration.md:         hook installation
  - docs/features/branch-context-management.md: init creates hooks
required_docs: []
sources:
  - src/branchctx/commands/uninstall.py: uninstall command
  - src/branchctx/core/hooks.py:         hook removal logic
---

# Uninstall Management

## Uninstall Command

### Remove Local Hooks

```bash
bctx uninstall
```

Removes:
- `.git/hooks/post-checkout` (if managed by bctx)
- `.git/hooks/post-commit` (if managed by bctx)

If hooks were appended to existing hooks, only the bctx snippet is removed.

### Remove Global Hooks Path

```bash
bctx uninstall --global
```

Unsets `core.hooksPath` git config if set globally.

## Uninstall Flow

```
┌───────────────────────────────────────────────────────────────┐
│                     uninstall_hook()                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Check all possible hook locations                         │
│     - .git/hooks/                                             │
│     - {core.hooksPath}/                                       │
│     - .husky/ (if detected)                                   │
│                                                               │
│  2. For each hook file found:                                 │
│                                                               │
│     ┌─────────────────────┐                                   │
│     │ Contains bctx       │                                   │
│     │ marker?             │                                   │
│     └──────────┬──────────┘                                   │
│                │                                              │
│     ┌──────────┴──────────┐                                   │
│     ↓                     ↓                                   │
│  Standalone            Appended                               │
│  (delete file)         (remove snippet)                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Snippet Detection

### Standalone Hook

Full hook file created by bctx:

```bash
#!/bin/sh
# branch-ctx-managed
...
```

Action: Delete entire file

### Appended Hook

bctx callback added to existing hook:

```bash
#!/bin/sh
# existing content...

# branch-ctx-managed
...callback...
# branch-ctx-end
```

Action: Remove only the bctx section, preserve rest

## Uninstall Results

| Result        | Meaning                             |
|---------------|-------------------------------------|
| uninstalled   | Hook successfully removed           |
| not_installed | Hook was not present                |
| not_managed   | Hook exists but not managed by bctx |

## What Remains

After uninstall:
- `.bctx/` directory (config, templates, branches)
- `_branch/` symlink
- `.gitignore` entries

Manual cleanup if needed:
```bash
rm -rf .bctx/
rm _branch
```
