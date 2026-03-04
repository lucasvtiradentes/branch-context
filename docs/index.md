---
title: Documentation Index
description: Table of contents for all project documentation
related_docs:
  - docs/architecture.md:                       system design and data flows
  - docs/overview.md:                           project overview
  - docs/rules.md:                              coding principles and conventions
  - docs/testing.md:                            test framework and patterns
  - docs/features/branch-context-management.md: branch context management
  - docs/features/context-metadata.md:          context metadata tracking
  - docs/features/repository-status.md:         health checks and status
  - docs/features/shell-integration.md:         shell completions and hooks
  - docs/features/uninstall-management.md:      uninstall and cleanup
  - docs/guides/create-release.md:              release guide
  - docs/repo/cicd.md:                          CI/CD pipelines
  - docs/repo/local-setup.md:                   dev environment setup
  - docs/repo/structure.md:                     codebase organization
  - docs/repo/tooling.md:                       development tools
required_docs: []
sources: []
---

## Documentation Index

| Category  | File                                       | Description                                                                         | Rel. docs | Req. docs | Sources |
|-----------|--------------------------------------------|-------------------------------------------------------------------------------------|-----------|-----------|---------|
| Top-Level | docs/architecture.md                       | System design, data flows, and component interactions                               |     2     |     1     |    5    |
|           | docs/overview.md                           | Git branch context manager that syncs context folders across branches automatically |     2     |     0     |    3    |
|           | docs/rules.md                              | Coding principles, conventions, and anti-patterns                                   |     2     |     0     |    1    |
|           | docs/testing.md                            | Test framework, patterns, and test locations                                        |     2     |     0     |    3    |
|-----------|--------------------------------------------|-------------------------------------------------------------------------------------|-----------|-----------|---------|
| features  | docs/features/branch-context-management.md | Initialize repos, manage branch contexts, and apply templates                       |     2     |     1     |    5    |
|           | docs/features/context-metadata.md          | Meta tracking, context tags, and base branch management                             |     2     |     1     |    3    |
|           | docs/features/repository-status.md         | Health checks and status reporting                                                  |     2     |     0     |    1    |
|           | docs/features/shell-integration.md         | Shell completions, git hooks, and sound notifications                               |     2     |     0     |    5    |
|           | docs/features/uninstall-management.md      | Removing git hooks and cleanup procedures                                           |     2     |     0     |    2    |
|-----------|--------------------------------------------|-------------------------------------------------------------------------------------|-----------|-----------|---------|
| guides    | docs/guides/create-release.md              | How to create and publish a new version to PyPI                                     |     2     |     0     |    4    |
|-----------|--------------------------------------------|-------------------------------------------------------------------------------------|-----------|-----------|---------|
| repo      | docs/repo/cicd.md                          | Continuous integration and deployment pipelines                                     |     2     |     0     |    1    |
|           | docs/repo/local-setup.md                   | How to set up the development environment                                           |     2     |     0     |    2    |
|           | docs/repo/structure.md                     | Codebase organization and file layout                                               |     2     |     0     |    2    |
|           | docs/repo/tooling.md                       | Development tools, linting, testing, and build configuration                        |     2     |     0     |    3    |
