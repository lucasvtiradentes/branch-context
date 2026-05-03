---
title: Create Changesets
description: Add concise Changesets entries for CLI and VS Code extension releases.
---

# Create Changesets

## Motivation

Use Changesets when a published package needs a version bump and changelog entry.

This repo has two release targets:

- `branch-context`:        npm CLI from `apps/cli`
- `branch-context-vscode`: VS Code extension from `apps/vscode-extension`

## Commands

Humans can create a changeset interactively:

```sh
pnpm changeset
```

Agents should create a markdown file directly under `.changeset/`.

Check package names:

```sh
node -p "require('./apps/cli/package.json').name"
node -p "require('./apps/vscode-extension/package.json').name"
```

## Version Types

- `patch`: bug fixes, build fixes, docs for published behavior
- `minor`: new backward-compatible features
- `major`: breaking changes

## Process

1. Pick the package that ships the change.
2. Pick `patch`, `minor`, or `major`.
3. Write one short release note.
4. Run `docalign .changeset/file-name.md --fix`.
5. Verify with `pnpm changeset status --verbose`.

Do not rely on `pnpm changeset status --since main` before the changeset file is tracked or
committed; it can report no changesets even when a new local changeset file exists.

## Ignored Packages

`@branch-context/core` is ignored by Changesets. When a core change affects published behavior,
add the changeset to the package that ships the behavior:

- CLI impact:               `branch-context`
- VS Code extension impact: `branch-context-vscode`

Example:

```md
---
"branch-context": patch
---

Copy core resources into the CLI dist so published installs include runtime files.
```
