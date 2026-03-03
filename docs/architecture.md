---
title: Architecture
description: System design, data flows, and component interactions
related_docs:
  - docs/overview.md:       high-level project overview
  - docs/repo/structure.md: codebase organization
required_docs:
  - docs/overview.md:         context for understanding architecture
sources:
  - src/branchctx/cli.py:          CLI dispatcher
  - src/branchctx/cmd_registry.py: command registration
  - src/branchctx/core/:           core logic (sync, hooks, context_tags)
  - src/branchctx/data/:           data management (config, meta, branch_base)
  - src/branchctx/utils/:          utilities (git, template)
---

# Architecture

## Entry Point

CLI dispatcher (`cli.py`) routes commands via `cmd_registry`:

```
┌─────────────────────────────────────────────────────────────────┐
│                         cli.py main()                           │
├─────────────────────────────────────────────────────────────────┤
│  argv[1]  →  cmd_registry.get_command_handler()  →  execute     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │  init   │          │  sync   │          │ status  │
   └─────────┘          └─────────┘          └─────────┘
```

## Command Flow

### CLI Command Execution

```
┌──────────┐   ┌────────────┐   ┌──────────────┐   ┌────────────┐
│  User    │──→│  cli.py    │──→│ cmd_registry │──→│  command   │
│  $ bctx  │   │  main()    │   │  dispatch    │   │  handler   │
└──────────┘   └────────────┘   └──────────────┘   └────────────┘
```

### Git Hook Flow (post-checkout)

```
┌──────────────┐   ┌─────────────────┐   ┌───────────────────────┐
│ git checkout │──→│ post-checkout   │──→│ bctx on-checkout      │
│              │   │ hook            │   │ $OLD $NEW             │
└──────────────┘   └─────────────────┘   └───────────┬───────────┘
                                                     │
                   ┌─────────────────────────────────┼────────────┐
                   │                                 ↓            │
                   │  ┌──────────────┐    ┌──────────────────┐    │
                   │  │ sync_branch  │───→│ update_meta      │    │
                   │  │              │    │                  │    │
                   │  └──────────────┘    └────────┬─────────┘    │
                   │                               │              │
                   │  ┌──────────────┐    ┌────────↓─────────┐    │
                   │  │ update       │←───│ update_context   │    │
                   │  │ symlink      │    │ _tags            │    │
                   │  └──────────────┘    └──────────────────┘    │
                   └──────────────────────────────────────────────┘
```

### Git Hook Flow (post-commit)

```
┌──────────────┐   ┌─────────────────┐   ┌───────────────────────┐
│ git commit   │──→│ post-commit     │──→│ bctx on-commit        │
│              │   │ hook            │   │                       │
└──────────────┘   └─────────────────┘   └───────────┬───────────┘
                                                     │
                                                     ↓
                                         ┌───────────────────────┐
                                         │ update_branch_meta    │
                                         │ + update_context_tags │
                                         └───────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Data Sources                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │ git status  │    │ git log     │    │ git diff                │  │
│  │ git branch  │    │ --oneline   │    │ base..HEAD              │  │
│  └──────┬──────┘    └──────┬──────┘    └────────────┬────────────┘  │
│         │                  │                        │               │
│         └──────────────────┼────────────────────────┘               │
│                            ↓                                        │
│                   ┌────────────────┐                                │
│                   │ utils/git.py   │                                │
│                   └────────┬───────┘                                │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Storage                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ .bctx/           │  │ .bctx/branches/ │  │ .bctx/branches/     │ │
│  │ config.json      │  │ meta.json       │  │ {branch}/           │ │
│  │                  │  │ - commits       │  │ - context.md        │ │
│  │ - default_base   │  │ - changed_files │  │ - base_branch       │ │
│  │ - template_rules │  │ - updated_at    │  │                     │ │
│  └────────┬─────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                     │                      │            │
│           ↓                    ↓                      ↓             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    data/ modules                            │    │
│  │  config.py          meta.py          branch_base.py         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      Context Output                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ _branch/ symlink  →  .bctx/branches/{current-branch}/       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Context tags updated in-place:                                     │
│  - <bctx:commits>...</bctx:commits>                                 │
│  - <bctx:files>...</bctx:files>                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Git Integration

### Hook Installation

```
┌────────────────────────────────────────────────────────────────┐
│                    Hook Locations                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Standard:    .git/hooks/post-checkout                         │
│               .git/hooks/post-commit                           │
│                                                                │
│  Custom:      {core.hooksPath}/post-checkout                   │
│               {core.hooksPath}/post-commit                     │
│                                                                │
│  Husky:       .husky/post-checkout (detected via .husky/h)     │
│               .husky/post-commit                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Git Queries (utils/git.py)

| Function             | Git Command                 | Returns              |
|----------------------|-----------------------------|----------------------|
| git_root()           | rev-parse --show-toplevel   | repo root path       |
| git_current_branch() | rev-parse --abbrev-ref HEAD | branch name          |
| git_list_branches()  | branch --format=short       | list of branch names |
| git_hooks_path()     | config core.hooksPath       | custom hooks dir     |

## Template System

### Variable Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│                   Template Variables                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  {{branch}}        →  current branch name                       │
│  {{date}}          →  current date                              │
│  {{author}}        →  git user.name                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Template Selection

```
┌───────────────────┐   ┌─────────────────────────────────────────┐
│ Branch: feat/auth │──→│ Check template_rules in config.json     │
└───────────────────┘   └──────────────────┬──────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ↓                                     ↓
              ┌─────────────────────┐              ┌──────────────────┐
              │ Match "feat/" rule  │              │ No match         │
              │ → use "feature"     │              │ → use "_default" │
              │ template            │              │ template         │
              └─────────────────────┘              └──────────────────┘
```

## Module Dependencies

```
cli.py
  └── cmd_registry.py
        └── commands/
              ├── init.py        → core/hooks.py, core/sync.py, data/config.py
              ├── sync.py        → core/sync.py, data/config.py, data/meta.py
              ├── status.py      → core/hooks.py, data/config.py
              ├── branches.py    → core/sync.py
              ├── template.py    → core/sync.py, core/context_tags.py
              ├── on_checkout.py → core/sync.py, core/context_tags.py
              ├── on_commit.py   → core/context_tags.py, data/meta.py
              ├── completion.py  → cmd_registry.py
              └── uninstall.py   → core/hooks.py

core/
  ├── hooks.py        → utils/git.py
  ├── sync.py         → data/config.py, data/meta.py, data/branch_base.py, utils/template.py
  └── context_tags.py → data/meta.py

data/
  ├── config.py       → (standalone)
  ├── meta.py         → utils/git.py
  └── branch_base.py  → (standalone)
```
