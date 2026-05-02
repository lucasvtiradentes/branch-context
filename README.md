<a name="TOC"></a>

<div align="center">
  <img height="80" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/apps/vscode-extension/resources/icon-colored.png" alt="branch-context logo">
  <div>Branch Context</div>
  <br />
  <a href="#-overview">Overview</a> • <a href="#-features">Features</a> • <a href="#-packages">Packages</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-commands">Commands</a> • <a href="#-configuration">Configuration</a> • <a href="#-development">Development</a> • <a href="#-license">License</a>
</div>

<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>

## 🎯 Overview<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

Branch Context is a Git branch context manager. It keeps notes, metadata, templates, git summaries, and AI session references isolated per branch through `.bctx/` and the current `_branch/context.md` symlink.

Use it to keep AI agents and developers aligned with the current branch intent, touched files, commits, tasks, and follow-up notes.

## ⭐ Features<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

- Per-branch context folders under `.bctx/branches`
- `_branch/` symlink pointing to the active branch context
- Auto-created contexts through Git checkout hooks
- Auto-updated commit and changed-file summaries after commits
- Context templates for feature, fix, chore, and default branches
- CLI commands for init, sync, status, base branch, templates, agents, and cleanup
- VS Code views and commands for branch context, git changes, templates, and AI sessions

<div align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=lucasvtiradentes.branch-context-vscode"><img src="https://img.shields.io/badge/VS%20Code-Extension-blue.svg" alt="VS Marketplace"></a>
  <a href="https://open-vsx.org/extension/lucasvtiradentes/branch-context-vscode"><img src="https://img.shields.io/open-vsx/v/lucasvtiradentes/branch-context-vscode?label=Open%20VSX&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2aWV3Qm94PSI0LjYgNSA5Ni4yIDEyMi43IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Ik0zMCA0NC4yTDUyLjYgNUg3LjN6TTQuNiA4OC41aDQ1LjNMMjcuMiA0OS40em01MSAwbDIyLjYgMzkuMiAyMi42LTM5LjJ6IiBmaWxsPSIjYzE2MGVmIi8+CiAgPHBhdGggZD0iTTUyLjYgNUwzMCA0NC4yaDQ1LjJ6TTI3LjIgNDkuNGwyMi43IDM5LjEgMjIuNi0zOS4xem01MSAwTDU1LjYgODguNWg0NS4yeiIgZmlsbD0iI2E2MGVlNSIvPgo8L3N2Zz4=&labelColor=a60ee5&color=374151" alt="Open VSX"></a>
</div>

## 📦 Packages<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

<table>
  <tr>
    <th>Path</th>
    <th>Purpose</th>
  </tr>
  <tr>
    <td><code>apps/cli</code></td>
    <td>CLI package published as <code>branch-context</code>, exposing <code>bctx</code> and <code>branch-ctx</code>.</td>
  </tr>
  <tr>
    <td><code>apps/vscode-extension</code></td>
    <td>VS Code extension with activity bar views, commands, status bar integration, and context.md helpers.</td>
  </tr>
  <tr>
    <td><code>packages/core</code></td>
    <td>Shared logic for config, sync, hooks, templates, git summaries, status, and agent sessions.</td>
  </tr>
</table>

## 🚀 Quick Start<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

```sh
pnpm install
pnpm build
pnpm --filter branch-context dev init
pnpm --filter branch-context dev status
```

After `init`, the repo gets `.bctx/` configuration and Git hooks. The current branch context is available at:

```sh
_branch/context.md
```

## 🧰 Commands<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

```sh
bctx init
bctx sync
bctx status
bctx base
bctx base origin/main
bctx template
bctx template feature
bctx agents status
bctx prune
bctx uninstall
```

## ⚙️ Configuration<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

Default config lives in `.bctx/config.json`:

```json
{
  "default_base_branch": "main",
  "sound": true,
  "commit_description": false,
  "template_rules": [
    { "prefix": "feature/", "template": "feature" },
    { "prefix": "fix/", "template": "fix" },
    { "prefix": "bugfix/", "template": "fix" },
    { "prefix": "chore/", "template": "chore" },
    { "prefix": "refactor/", "template": "chore" }
  ]
}
```

Templates are stored in `.bctx/templates` after init and are sourced from `packages/core/resources/templates`.

## 🛠️ Development<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm check
```

Useful package scripts:

```sh
pnpm --filter branch-context dev status
pnpm --filter branch-context-vscode build
pnpm --filter @branch-context/core test
```

## 📜 License<a href="#TOC"><img align="right" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/up_arrow.png" width="22"></a>

MIT

<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>

<br />

<div align="center">
  <div>
    <a target="_blank" href="https://www.linkedin.com/in/lucasvtiradentes/"><img src="https://img.shields.io/badge/-linkedin-blue?logo=Linkedin&logoColor=white" alt="LinkedIn"></a>
    <a target="_blank" href="mailto:lucasvtiradentes@gmail.com"><img src="https://img.shields.io/badge/gmail-red?logo=gmail&logoColor=white" alt="Gmail"></a>
    <a target="_blank" href="https://x.com/lucasvtiradente"><img src="https://img.shields.io/badge/-X-black?logo=X&logoColor=white" alt="X"></a>
    <a target="_blank" href="https://github.com/lucasvtiradentes"><img src="https://img.shields.io/badge/-github-gray?logo=Github&logoColor=white" alt="Github"></a>
  </div>
</div>
