<a name="TOC"></a>

<div align="center">
  <!-- <DYNFIELD:HEADER_LOGO> -->
  <img height="80" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/apps/vscode-extension/resources/icon-colored.png" alt="branch-context logo">
  <!-- </DYNFIELD:HEADER_LOGO> -->
  <div>Branch Context</div>
  <br />
  <a href="#-overview">Overview</a> • <a href="#-motivation">Motivation</a> • <a href="#-features">Features</a> • <a href="#-packages">Packages</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-commands">Commands</a> • <a href="#-configuration">Configuration</a> • <a href="#-license">License</a>
</div>

<!-- <DYNFIELD:TOP_DIVIDER> -->
<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>
<!-- </DYNFIELD:TOP_DIVIDER> -->

## 🎺 Overview

AI agents are stateless, but work is organized in branches. Branch Context pins a folder to each branch and exposes it at a fixed path (`_branch/`), a stable target for your agents and hooks, automatically swapped on checkout.

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/demo.png" alt="Branch Context VS Code extension demo">
</div>

## ❓ Motivation

I was tired of re-briefing Codex, Claude Code, and Pi about the same branch on every new session. I wanted one place to drop everything tied to a branch (e.g. scratch scripts, test files, decisions) that my agents could read on startup and that wouldn't follow me when I switched branches. So I built it.

## ⭐ Features

- One folder per branch, active one always at `_branch/` (stable path for agent hooks)
- `context.md` auto-syncs commits and changed files, so months later the history is still there
- Deleted branches auto-restore their context when checked out again
- Per-branch-type templates (feature, fix, chore, …) matched by prefix
- CLI (`bctx`) and VS Code extension

## 📦 Packages

<div align="center">
<table>
  <tr>
    <th>Package</th>
    <th>Repo</th>
    <th>Download</th>
  </tr>
  <tr>
    <td align="center">CLI</td>
    <td align="center"><a href="https://github.com/lucasvtiradentes/branch-context/tree/main/apps/cli"><code>apps/cli</code></a></td>
    <td align="center"><a href="https://www.npmjs.com/package/branch-context"><img src="https://img.shields.io/npm/v/branch-context?label=npm&color=cb3837&logo=npm" alt="npm"></a></td>
  </tr>
  <tr>
    <td align="center">VS Code extension</td>
    <td align="center"><a href="https://github.com/lucasvtiradentes/branch-context/tree/main/apps/vscode-extension"><code>apps/vscode-extension</code></a></td>
    <td align="center">
      <a href="https://marketplace.visualstudio.com/items?itemName=lucasvtiradentes.branch-context-vscode"><img src="https://img.shields.io/badge/VS%20Code-Extension-blue.svg" alt="VS Marketplace"></a>
      <a href="https://open-vsx.org/extension/lucasvtiradentes/branch-context-vscode"><img src="https://img.shields.io/open-vsx/v/lucasvtiradentes/branch-context-vscode?label=Open%20VSX&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2aWV3Qm94PSI0LjYgNSA5Ni4yIDEyMi43IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Ik0zMCA0NC4yTDUyLjYgNUg3LjN6TTQuNiA4OC41aDQ1LjNMMjcuMiA0OS40em01MSAwbDIyLjYgMzkuMiAyMi42LTM5LjJ6IiBmaWxsPSIjYzE2MGVmIi8+CiAgPHBhdGggZD0iTTUyLjYgNUwzMCA0NC4yaDQ1LjJ6TTI3LjIgNDkuNGwyMi43IDM5LjEgMjIuNi0zOS4xem01MSAwTDU1LjYgODguNWg0NS4yeiIgZmlsbD0iI2E2MGVlNSIvPgo8L3N2Zz4=&labelColor=a60ee5&color=374151" alt="Open VSX"></a>
    </td>
  </tr>
</table>
</div>

## 🚀 Quick Start

1. Install the CLI globally:

   ```sh
   npm i -g branch-context
   ```

2. Inside each repo where you want to use it, run:

   ```sh
   bctx init
   ```

   This sets up `.bctx/` and Git hooks. `_branch/context.md` now points at the active branch's context and stays in sync on checkout and commit.

3. (Optional) Install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=lucasvtiradentes.branch-context-vscode) for a richer view: branch context, branch changes, templates, and resumable agent sessions in the sidebar.

4. (Optional) For branch-scoped Pi sessions, install the Pi package:

   ```sh
   pi install git:github.com/lucasvtiradentes/branch-context
   ```

   New Pi sessions now record `branch-context` metadata via `pi.appendEntry()`. Existing Pi sessions without that entry are treated as repo-scoped fallback sessions.

## 🧰 Commands

<!-- <DYNFIELD:COMMANDS> -->
```sh
bctx init             # set up .bctx/ and Git hooks
bctx sync             # refresh commit/file summaries
bctx status           # check setup health and list branch contexts
bctx base             # get/set base branch
bctx template [name]  # apply a template (e.g. fix, feature)
bctx prune            # archive contexts of deleted branches
bctx agents status    # show indexed AI session pointers for the branch
bctx uninstall        # remove .bctx/ and hooks
```
<!-- </DYNFIELD:COMMANDS> -->

## ⚙️ Configuration

Default `.bctx/config.json`:

<!-- <DYNFIELD:CONFIG_JSON> -->
```json
{
  "default_base_branch": "origin/main",
  "sound": true,
  "commit_description": false,
  "branches_folder": ".bctx/branches",
  "templates_folder": ".bctx/templates"
}
```
<!-- </DYNFIELD:CONFIG_JSON> -->

## 📜 License

[MIT](https://github.com/lucasvtiradentes/branch-context/blob/main/LICENSE)

<!-- <DYNFIELD:FOOTER> -->
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
<!-- </DYNFIELD:FOOTER> -->
