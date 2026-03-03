---
title: CI/CD
description: Continuous integration and deployment pipelines
related_docs:
  - docs/repo/tooling.md: tools used in pipelines
  - docs/testing.md:      test configuration
required_docs: []
sources:
  - .github/workflows/:       GitHub Actions workflows
---

# CI/CD

## Pipelines

```
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub Actions                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pull Request  ──→  prs.yml  ──→  callable-ci.yml               │
│                                                                 │
│  Push to main  ──→  push-to-main.yml  ──→  callable-ci.yml      │
│                                                                 │
│  Manual        ──→  release.yml  ──→  PyPI publish              │
│                                                                 │
│  Weekly        ──→  check-completion.yml                        │
│                                                                 │
│  Daily         ──→  update-docs.yml                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## CI Checks (callable-ci.yml)

### check job

- Runner: ubuntu-latest
- Python: 3.12
- Steps:
  - `ruff check .`
  - `ruff format --check .`

### integration job

- Runner: ubuntu-latest
- Matrix: Python 3.9, 3.10, 3.11, 3.12, 3.13
- Steps:
  - `pytest tests/integration -v`

### e2e job

- Matrix: ubuntu-latest, windows-latest, macos-latest
- Python: 3.12
- Steps:
  - `pytest tests/e2e -v`

## Release Pipeline (release.yml)

Triggered manually with version bump input (patch/minor/major/initial).

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ bump2version   │──→│ towncrier      │──→│ hatch build    │
│ ${{ bump }}    │   │ changelog      │   │                │
└────────────────┘   └────────────────┘   └────────┬───────┘
                                                   │
┌────────────────┐   ┌────────────────┐   ┌────────↓───────┐
│ push main      │←──│ commit + tag   │←──│ PyPI publish   │
│ + tags         │   │                │   │                │
└────────────────┘   └────────────────┘   └────────────────┘
```

## Secrets

| Secret                  | Used By          | Purpose            |
|-------------------------|------------------|--------------------|
| CLAUDE_CODE_OAUTH_TOKEN | check-completion, update-docs | Claude Code auth   |
| GITHUB_TOKEN            | all workflows    | Git operations     |
| (PyPI trusted pub)      | release.yml      | Package publishing |

## Branch Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│  main (protected)                                               │
│    │                                                            │
│    ├── PR ── checks pass ── merge                               │
│    │                                                            │
│    └── manual release ── version bump ── PyPI publish           │
└─────────────────────────────────────────────────────────────────┘
```
