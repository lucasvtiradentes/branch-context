---
title: Overview
description: Git branch context manager that syncs context folders across branches automatically
related_docs:
  - docs/architecture.md: system design and data flows
  - docs/features/:       detailed feature documentation
required_docs: []
sources:
  - src/branchctx/cli.py: CLI entry point
  - src/branchctx/core/:  core sync and hooks logic
  - src/branchctx/data/:  config, meta, branch_base management
---

# Overview

branch-ctx is a Git branch context manager that automatically syncs context folders across branches. Each branch gets an isolated context directory containing notes, metadata, and files that follow the branch lifecycle.

## Core Features

- Per-branch isolated contexts at `.bctx/branches/{branch-name}/`
- Auto-sync via git hooks (post-checkout, post-commit)
- Template system with per-prefix rules
- Symlink to current branch context at `_branch/`

## Installation

```
pip install branch-ctx
```

## CLI Commands

```
┌──────────────────────────────────────────────────────────────┐
│  bctx init         Initialize repo + install hooks           │
│  bctx sync         Manually sync current branch context      │
│  bctx status       Show status and health check              │
│  bctx branches     List/prune branch contexts                │
│  bctx template     Apply template to current context         │
│  bctx completion   Generate shell completions                │
│  bctx uninstall    Remove git hooks                          │
└──────────────────────────────────────────────────────────────┘
```

## Configuration

Configuration lives at `.bctx/config.json`:

| Field               | Type   | Description                        |
|---------------------|--------|------------------------------------|
| default_base_branch | string | Base branch for new contexts       |
| sound               | bool   | Play sound on branch switch        |
| sound_file          | string | Custom sound file path             |
| template_rules      | object | Branch prefix to template mappings |

## Workflow

```
┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ git checkout │───→│ post-checkout    │───→│ sync_branch()     │
│              │    │ hook fires       │    │                   │
└──────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                      │
                   ┌──────────────────┐    ┌─────────↓─────────┐
                   │ update symlink   │←───│ create/update     │
                   │ _branch/ -> ctx  │    │ context dir       │
                   └──────────────────┘    └───────────────────┘
```

## Context Structure

Each branch context directory contains:

```
.bctx/branches/{branch-name}/
├── context.md        Main context file (from template)
├── base_branch       Override base branch for this context
└── (other files)     Additional context files
```

The `_branch/` symlink always points to the current branch's context directory, providing a stable path for tools like Claude.
