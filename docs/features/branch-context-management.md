---
title: Branch Context Management
description: Initialize repos, manage branch contexts, and apply templates
related_docs:
  - docs/features/context-metadata.md:  meta tracking and context tags
  - docs/features/shell-integration.md: git hooks and completions
required_docs:
  - docs/overview.md:                    understand core concepts
sources:
  - src/branchctx/commands/init.py:     init command
  - src/branchctx/commands/branches.py: branches command
  - src/branchctx/commands/template.py: template command
  - src/branchctx/commands/sync.py:     sync command
  - src/branchctx/core/sync.py:         sync logic
---

# Branch Context Management

## Initialize Repository

```bash
bctx init
```

Creates:
- `.bctx/config.json` - configuration file
- `.bctx/templates/`  - template directory with defaults
- `.bctx/branches/`   - branch context storage (gitignored)
- Git hooks (post-checkout, post-commit)
- `_branch/` symlink to current context

```
.bctx/
├── config.json
├── templates/
│   ├── _default/
│   │   └── context.md
│   └── feature/
│       └── context.md
└── branches/
    └── main/
        └── context.md
```

## Manage Branch Contexts

### List Contexts

```bash
bctx branches list
```

Output:
```
Branch contexts (3):

  * main (2 files)
    feature-auth (3 files)
    fix-bug-123 (2 files)

Archived: 1
```

### Prune Orphan Contexts

```bash
bctx branches prune
```

Archives contexts for branches that no longer exist in git.

```
┌─────────────────┐         ┌──────────────────────────┐
│ .bctx/branches/ │   ──→   │ .bctx/branches/_archived/│
│ deleted-branch/ │ prune   │ deleted-branch/           │
└─────────────────┘         └──────────────────────────┘
```

## Template System

### Default Templates

Templates stored in `.bctx/templates/`:

| Template | Description               |
|----------|---------------------------|
| _default | Fallback for all branches |
| feature  | For feature/* branches    |
| fix      | For fix/* branches        |
| (custom) | User-defined templates    |

### Template Rules

Configure in `.bctx/config.json`:

```json
{
  "template_rules": [
    {"prefix": "feature/", "template": "feature"},
    {"prefix": "fix/", "template": "fix"},
    {"prefix": "hotfix/", "template": "fix"}
  ]
}
```

### Apply Template

Interactive selection:
```bash
bctx template
```

Direct application:
```bash
bctx template feature
```

## Manual Sync

```bash
bctx sync
```

Forces sync of current branch context:
1. Creates context if missing (from template)
2. Updates `_branch/` symlink
3. Updates meta info
4. Refreshes context tags

## Sync Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                        sync_branch()                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Resolve template                                              │
│     ┌────────────────┐    ┌─────────────────┐                     │
│     │ Check prefix   │───→│ template_rules  │                     │
│     │ "feature/auth" │    │ → "feature"     │                     │
│     └────────────────┘    └─────────────────┘                     │
│                                 │                                 │
│  2. Create context              ↓                                 │
│     ┌────────────────┐    ┌─────────────────┐                     │
│     │ Copy template  │───→│ .bctx/branches/ │                     │
│     │ files          │    │ feature-auth/   │                     │
│     └────────────────┘    └─────────────────┘                     │
│                                 │                                 │
│  3. Render variables            ↓                                 │
│     ┌────────────────┐    ┌─────────────────┐                     │
│     │ {{branch}}     │───→│ feature/auth    │                     │
│     │ {{date}}       │───→│ 2024-01-15      │                     │
│     └────────────────┘    └─────────────────┘                     │
│                                 │                                 │
│  4. Update symlink              ↓                                 │
│     ┌────────────────┐    ┌─────────────────┐                     │
│     │ _branch/       │───→│ .bctx/branches/ │                     │
│     │ (symlink)      │    │ feature-auth/   │                     │
│     └────────────────┘    └─────────────────┘                     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```
