---
name: branch-context
description: Manage Branch Context setup and usage. Use when user asks about bctx CLI, .bctx config/templates, _branch/context.md, branch context sync, Git hooks, or the VS Code extension.
---

# Branch Context

## Goal

Help users configure, inspect, and troubleshoot Branch Context without breaking branch-scoped context folders, Git hooks, templates, or VS Code extension behavior.

Branch Context gives each Git branch its own context folder and exposes the active one through `_branch/`.

## When to use

Use this skill for requests involving:
- `bctx` CLI commands or errors
- `.bctx/config.json`, `.bctx/templates/`, `.bctx/branches/`, `.bctx/_archived/`
- `_branch/context.md` and `<bctx:commits>` / `<bctx:files>` tags
- branch context sync on checkout or commit
- branch templates and base branch selection
- VS Code extension sidebar, commands, context file UX, git changes, or agent sessions

Do not treat this as a source-contributor skill unless the user explicitly asks to change Branch Context's source code.

## Source reference

Canonical repo: `https://github.com/lucasvtiradentes/branch-context`.

If local source is unavailable, inspect GitHub before making source-level claims. Key paths in that repo:
- Product docs:            `README.md`, `apps/cli/README.md`, `apps/vscode-extension/README.md`
- CLI:                     `apps/cli/src/commands/`
- VS Code extension:       `apps/vscode-extension/package.json`, `apps/vscode-extension/src/`
- Shared core:             `packages/core/src/`
- Config schema/resources: `packages/core/src/data/config-schema.ts`, `packages/core/resources/`

Prefer source evidence over README when behavior differs.

## Core paths

| Path                                     | Purpose                                             |
|------------------------------------------|-----------------------------------------------------|
| `apps/cli/src/commands/`                 | CLI command handlers                                |
| `apps/vscode-extension/src/features/`    | extension feature modules                           |
| `packages/core/src/use-cases/actions.ts` | init, sync, base, template, context actions         |
| `packages/core/src/core/sync.ts`         | branch folders, symlink, templates, archive logic   |
| `packages/core/src/core/hooks.ts`        | Git hook install/uninstall and managed snippets     |
| `packages/core/src/data/config.ts`       | config defaults, path resolution, template matching |
| `packages/core/resources/`               | default config, templates, hook resources           |

## CLI

Main binary: `bctx`. Key commands: `init`, `sync`, `status`, `base`, `template apply`, `template source`, `prune`, `agents status`, `uninstall`, `completion`.

Command behavior:
- `bctx init` creates `.bctx/config.json`, templates, branches folder, Git hooks, and syncs current branch.
- `bctx init --branches-parent-folder <path>` stores contexts under `<path>/branches`.
- `bctx init --templates-folder <path>` uses an existing or local templates folder.
- `bctx sync` creates or repairs current branch context, updates `_branch`, and refreshes managed tags.
- `bctx status` reports hooks, templates, symlink health, contexts, archived contexts, and orphans.
- `bctx base` prints current base; `bctx base <branch>` sets it for current context.
- `bctx template apply [name]` resets current context from a template.
- `bctx template source [path]` reads or updates templates folder.
- `bctx prune` interactively deletes safe local branches and archives orphan contexts.
- `bctx uninstall` removes managed `post-checkout` and `post-commit` hooks.
- `bctx uninstall --global` unsets global hooks path.

## Config

Default `.bctx/config.json` uses `origin/main`, sound on, and commit descriptions off.

Fields:

| Field                 | Type    | Meaning                                          |
|-----------------------|---------|--------------------------------------------------|
| `$schema`             | string  | JSON schema URL                                  |
| `default_base_branch` | string  | ref used for commits and changed files           |
| `sound`               | boolean | play sound after sync                            |
| `sound_file`          | string  | custom sound file path                           |
| `commit_description`  | boolean | include commit body in generated commits section |

Notes:
- Machine config uses `~/.config/branch-context/config.json` with `shared_path`.
- Branch template matching uses prefix before `/`, e.g. `fix/foo` → `fix`.

## Branch context model

Default layout:

```text
.bctx/
  config.json
  templates/<name>/context.md
  branches/
    meta.json
    <sanitized-branch>/
      .config/base_branch
      .config/sessions.json
      context.md
    _archived/
_branch -> .bctx/branches/<sanitized-current-branch>
```

Rules:
- Branch names are sanitized with `sanitizeBranchName()` for folder names.
- `_branch` must be a symlink. If a real file/folder exists there, sync reports an error.
- Deleted branch contexts can be archived under `.bctx/_archived/` and restored when branch returns.
- Keep `context.md` frontmatter and managed comment block.
- Do not manually edit `<bctx:commits>` or `<bctx:files>` blocks; hooks update them.

## Templates

Template folders live under `.bctx/templates` in local mode and `<shared_path>/templates` in shared mode. `_default` is required.

Rendered extensions:

```text
.md .txt .json .yaml .yml .toml
```

Other files are copied without rendering. Template variables come from `getTemplateVariables(branch)`.

## Git hooks

Managed hooks:
- `post-checkout` calls `bctx on-checkout`
- `post-commit` calls `bctx on-commit`

Rules:
- Managed snippets contain `# branch-ctx-managed` and end with `# branch-ctx-end`.
- Existing unmanaged hooks are not overwritten unless user confirms append.
- Custom `core.hooksPath` and Husky-style hook dirs are supported.
- Hook files may be added to `.git/info/exclude`.
- Do not delete unmanaged hook content.

## VS Code extension

Package: `apps/vscode-extension`.

Activation flow:
- `initializeCore()`:    logger and persisted state.
- `initializeUi()`:      git diff provider, context UX, tree views, commands.
- `initializeRuntime()`: branch context watcher and agent session indexer.

Views:
- Branch AI Sessions: indexed local agent sessions, grouping, resume, pin, rename, delete.
- Branch Git Changes: changed files and commits versus base branch.
- Other Branches:     contexts, checkout, archive, restore, delete.
- Config:             mode, current branch, base branch, template, CLI info, issues.

Important commands use `branch-context.*`. Check `apps/vscode-extension/package.json` before changing command ids, menus, views, or activation behavior.

## Safety guards

- Treat `bctx prune`, `bctx uninstall`, context delete/archive/restore, branch delete, and reset-template flows as destructive.
- Never remove `_branch`, `.bctx/branches`, `.bctx/_archived`, or Git hooks without explicit user request.
- Preserve unmanaged Git hook content.
- Do not hand-edit generated README dynamic blocks unless running `pnpm update-docs` after.
- Do not claim setup health without checking `bctx status` or source evidence.

