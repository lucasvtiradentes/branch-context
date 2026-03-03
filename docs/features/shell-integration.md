---
title: Shell Integration
description: Shell completions, git hooks, and sound notifications
related_docs:
  - docs/features/branch-context-management.md: init installs hooks
  - docs/overview.md:                           workflow overview
required_docs: []
sources:
  - src/branchctx/commands/completion.py:  completion generation
  - src/branchctx/commands/on_checkout.py: post-checkout handler
  - src/branchctx/commands/on_commit.py:   post-commit handler
  - src/branchctx/core/hooks.py:           hook installation
  - src/branchctx/core/sync.py:            sound playback
---

# Shell Integration

## Shell Completions

### Generate Completions

```bash
bctx completion zsh    # Zsh
bctx completion bash   # Bash
bctx completion fish   # Fish
```

### Install Completions

Zsh:
```bash
eval "$(bctx completion zsh)"
```

Bash:
```bash
eval "$(bctx completion bash)"
```

Fish:
```bash
bctx completion fish | source
```

### Completion Features

| Context                 | Completions Provided           |
|-------------------------|--------------------------------|
| `bctx <tab>`            | All available commands         |
| `bctx template <tab>`   | Templates from .bctx/templates |
| `bctx branches <tab>`   | list, prune                    |
| `bctx completion <tab>` | zsh, bash, fish                |

## Git Hooks

### Post-Checkout Hook

Triggered by:
- `git checkout <branch>`
- `git switch <branch>`

Actions:
1. Call `bctx on-checkout $OLD $NEW`
2. Create/sync context for new branch
3. Update `_branch/` symlink
4. Update meta.json
5. Refresh context tags

```
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────┐
│ git checkout     │───→│ post-checkout hook  │───→│ bctx         │
│ feature/auth     │    │                     │    │ on-checkout  │
└──────────────────┘    └─────────────────────┘    └──────────────┘
```

### Post-Commit Hook

Triggered by:
- `git commit`

Actions:
1. Call `bctx on-commit`
2. Update meta.json with new commits
3. Refresh context tags

```
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────┐
│ git commit       │───→│ post-commit hook    │───→│ bctx         │
│                  │    │                     │    │ on-commit    │
└──────────────────┘    └─────────────────────┘    └──────────────┘
```

### Hook Locations

```
Standard:     .git/hooks/post-checkout
              .git/hooks/post-commit

Custom:       {core.hooksPath}/post-checkout
              {core.hooksPath}/post-commit

Husky:        .husky/post-checkout
              .husky/post-commit
```

### Hook Content

Generated hook script (post-checkout):

```bash
#!/bin/bash
# branch-ctx-managed

PREV_HEAD="$1"
NEW_HEAD="$2"
CHECKOUT_TYPE="$3"

if [ "$CHECKOUT_TYPE" == "1" ]; then
    OLD_BRANCH=$(git rev-parse --abbrev-ref @{-1} 2>/dev/null || echo "unknown")
    NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    "bctx" on-checkout "$OLD_BRANCH" "$NEW_BRANCH" "$PREV_HEAD" "$NEW_HEAD"
fi
```

### Append Mode

If existing hooks detected, bctx can append its callback:

```bash
#!/bin/sh
# existing hook content...

# branch-ctx-managed
OLD_BRANCH=$(git rev-parse --abbrev-ref @{-1} 2>/dev/null || echo "unknown")
NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
"bctx" on-checkout "$OLD_BRANCH" "$NEW_BRANCH"
# branch-ctx-end
```

## Sound Notification

### Configuration

In `.bctx/config.json`:

```json
{
  "sound": true,
  "sound_file": null
}
```

| Field      | Type   | Description                      |
|------------|--------|----------------------------------|
| sound      | bool   | Play sound on branch switch      |
| sound_file | string | Custom sound path (null=default) |

### Platform Support

| Platform | Player Command               |
|----------|------------------------------|
| macOS    | afplay                       |
| Linux    | paplay                       |
| Windows  | PowerShell Media.SoundPlayer |

Default sound bundled at `src/branchctx/assets/notification.oga`
