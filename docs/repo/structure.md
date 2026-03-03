---
title: Repository Structure
description: Codebase organization and file layout
related_docs:
  - docs/architecture.md: how components interact
  - docs/repo/tooling.md: development tools
required_docs: []
sources:
  - src/branchctx/: main package
  - tests/:         test suites
---

# Repository Structure

```
branch-context/
├── src/branchctx/
│   ├── __init__.py
│   ├── cli.py              CLI entry point
│   ├── cmd_registry.py     Command registration and dispatch
│   ├── constants.py        Shared constants
│   │
│   ├── commands/           CLI command handlers
│   │   ├── init.py         Initialize repo + install hooks
│   │   ├── sync.py         Manual sync current context
│   │   ├── status.py       Show status and health
│   │   ├── branches.py     List/prune contexts
│   │   ├── template.py     Apply template to context
│   │   ├── completion.py   Generate shell completions
│   │   ├── on_checkout.py  Post-checkout hook handler
│   │   ├── on_commit.py    Post-commit hook handler
│   │   └── uninstall.py    Remove git hooks
│   │
│   ├── core/               Core business logic
│   │   ├── hooks.py        Git hook installation/detection
│   │   ├── sync.py         Branch sync, template copy, symlink
│   │   └── context_tags.py Tag replacement in context files
│   │
│   ├── data/               Data management
│   │   ├── config.py       .bctx/config.json operations
│   │   ├── meta.py         .bctx/meta.json operations
│   │   └── branch_base.py  Per-branch base_branch override
│   │
│   ├── utils/              Utilities
│   │   ├── git.py          Git subprocess wrappers
│   │   └── template.py     Template variable resolution
│   │
│   └── assets/             Bundled files
│       ├── __init__.py     Asset loading helpers
│       ├── init/            Init assets and default templates
│       └── notification.oga Notification sound
│
├── tests/
│   ├── utils.py            Test utilities
│   ├── integration/        Command and core tests
│   │   ├── test_init.py
│   │   ├── test_sync.py
│   │   ├── test_hooks.py
│   │   ├── test_config.py
│   │   ├── test_meta.py
│   │   ├── test_git.py
│   │   ├── test_branches_cmd.py
│   │   ├── test_status_cmd.py
│   │   ├── test_context_tags.py
│   │   └── test_template_vars.py
│   │
│   └── e2e/                End-to-end tests
│       ├── test_e2e.py
│       ├── test_meta_e2e.py
│       └── test_context_tags_e2e.py
│
├── .github/workflows/      CI/CD pipelines
├── pyproject.toml          Package config
├── Makefile                Dev commands
└── README.md               User documentation
```

## Key Directories

| Directory              | Purpose                                  |
|------------------------|------------------------------------------|
| src/branchctx/commands | Each file = one CLI command              |
| src/branchctx/core     | Hook management, sync logic, tag updates |
| src/branchctx/data     | Config/meta JSON file operations         |
| src/branchctx/utils    | Git subprocess calls, template rendering |
| src/branchctx/assets   | Bundled templates and sound files        |
| tests/integration      | Unit/integration tests per module        |
| tests/e2e              | Full workflow tests                      |
