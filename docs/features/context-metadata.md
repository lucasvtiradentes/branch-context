---
title: Context Metadata
description: Meta tracking, context tags, and base branch management
related_docs:
  - docs/features/branch-context-management.md: context creation and templates
  - docs/features/shell-integration.md:         hooks that trigger updates
required_docs:
  - docs/overview.md:                           understand context structure
sources:
  - src/branchctx/data/meta.py:         meta.json operations
  - src/branchctx/data/branch_base.py:  base_branch file handling
  - src/branchctx/core/context_tags.py: tag replacement logic
---

# Context Metadata

## Meta Tracking

Branch metadata stored in `.bctx/branches/meta.json`:

```json
{
  "feature-auth": {
    "branch": "feature/auth",
    "created_at": "2024-01-15T10:30:00",
    "author": "Jane Doe",
    "updated_at": "2024-01-15T12:00:00",
    "last_commit": {"hash": "def456", "message": "Add validation", "datetime": "2024-01-15T12:00:00"},
    "commits": "abc123 Add login form\ndef456 Add validation",
    "changed_files": "src/auth.py\nsrc/login.py"
  }
}
```

### Meta Fields

| Field         | Type     | Description                           |
|---------------|----------|---------------------------------------|
| branch        | string   | Original branch name                  |
| created_at    | datetime | Creation timestamp                    |
| author        | string   | Git user who created the context      |
| updated_at    | datetime | Last update timestamp                 |
| last_commit   | object   | Last commit (hash, message, datetime) |
| commits       | string   | Commits since base (one per line)     |
| changed_files | string   | Files changed vs base                 |

### Update Flow

```
┌────────────────┐    ┌────────────────────┐    ┌────────────────┐
│ git checkout   │───→│ update_branch_meta │───→│ meta.json      │
│ git commit     │    │                    │    │ updated        │
└────────────────┘    └────────────────────┘    └────────────────┘
                              │
                              ↓
                      ┌──────────────────────┐
                      │ git log base..HEAD   │
                      │ git diff base...HEAD │
                      └──────────────────────┘
```

## Context Tags

Auto-updated tags in context files:

| Tag              | Content                         |
|------------------|---------------------------------|
| `<bctx:commits>` | Commits since base branch       |
| `<bctx:files>`   | Changed files since base branch |

### Example

In `context.md`:
```markdown
## Recent Commits
<bctx:commits>
abc123 Add login form
def456 Add validation
</bctx:commits>

## Changed Files
<bctx:files>
src/auth.py
src/login.py
</bctx:files>
```

### Tag Update Flow

```
┌───────────────────────────────────────────────────────────────┐
│                  update_context_tags()                        │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Find context files                                        │
│     ┌──────────────┐                                          │
│     │ .md, .txt    │  Scan context directory                  │
│     │              │                                          │
│     └──────┬───────┘                                          │
│            │                                                  │
│  2. Find tags in each file                                    │
│            ↓                                                  │
│     ┌─────────────────────────────────┐                       │
│     │ regex: <bctx:(commits|files)>   │                       │
│     │        ...content...            │                       │
│     │        </bctx:...>              │                       │
│     └──────┬──────────────────────────┘                       │
│            │                                                  │
│  3. Replace content with fresh data                           │
│            ↓                                                  │
│     ┌─────────────────────────────────┐                       │
│     │ commits  →  git log base..HEAD  │                       │
│     │ files   →  git diff base...HEAD │                       │
│     └─────────────────────────────────┘                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Base Branch

### Auto-Detection

Default base branch resolved from:
1. Per-branch override: `{context}/base_branch` file
2. Config default: `.bctx/config.json` -> `default_base_branch`
3. Fallback: `origin/main`

### Per-Branch Override

Create file in context directory:

```
.bctx/branches/feature-auth/base_branch
```

Contents:
```
develop
```

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   get_base_branch()                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Check: {context}/base_branch file exists?                      │
│         │                                                       │
│         ├── YES → return file contents                          │
│         │                                                       │
│         └── NO → Check: config.default_base_branch?             │
│                   │                                             │
│                   ├── YES → return config value                 │
│                   │                                             │
│                   └── NO → return "origin/main"                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Template Variables

Variables rendered when copying templates:

| Variable     | Example Value | Description         |
|--------------|---------------|---------------------|
| `{{branch}}` | feature/auth  | Current branch name |
| `{{date}}`   | 2024-01-15    | Current date        |
| `{{author}}` | Jane Doe      | Git user name       |

Supported file types: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`
