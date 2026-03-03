---
title: Create Release
description: How to create and publish a new version to PyPI
related_docs:
  - docs/repo/cicd.md:    CI/CD pipelines and release workflow
  - docs/repo/tooling.md: towncrier and bump2version setup
sources:
  - .github/workflows/release.yml: release workflow
  - .changelog/:                   changelog fragments
  - pyproject.toml:                towncrier config
  - .bumpversion.cfg:              version config
---

# Create Release

## Tools

- towncrier:    changelog generation
- bump2version: version bumping

## Changelog Fragments

During development, add fragments to `.changelog/`:

```
.changelog/+<name>.<type>.md
```

| Type    | Use case                |
|---------|-------------------------|
| feature | new features            |
| bugfix  | bug fixes               |
| misc    | refactors, chores, docs |

Example: `.changelog/+per-branch-base.feature.md`

## Release Flow

```
┌─────────────────────┐
│ 1. Add fragments    │
│    during dev       │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ 2. Merge to main    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ 3. Run release.yml  │
│    (patch/minor/    │
│     major/initial)  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Workflow actions:   │
│ - bump version      │
│ - towncrier build   │
│ - hatch build       │
│ - publish to PyPI   │
│ - commit + tag      │
└─────────────────────┘
```

## Commands

Preview changelog before release:

```bash
make changelog-draft
```

Trigger release (via GitHub Actions):

1. Go to Actions → release.yml
2. Click "Run workflow"
3. Select bump type: patch / minor / major / initial
