<a name="TOC"></a>

<div align="center">
  <!-- <DYNFIELD:HEADER_LOGO> -->
  <img height="80" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/apps/vscode-extension/resources/icon-colored.png" alt="branch-context logo">
  <!-- </DYNFIELD:HEADER_LOGO> -->
  <div>Branch Context CLI</div>
  <br />
  <a href="https://www.npmjs.com/package/branch-context"><img src="https://img.shields.io/npm/v/branch-context?label=npm&color=cb3837&logo=npm" alt="npm"></a>
  <br /><br />
  <a href="#-overview">Overview</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-commands">Commands</a> • <a href="#-configuration">Configuration</a> • <a href="#-license">License</a>
</div>

<!-- <DYNFIELD:TOP_DIVIDER> -->
<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>
<!-- </DYNFIELD:TOP_DIVIDER> -->

## 🎯 Overview

Command-line interface for [Branch Context](https://github.com/lucasvtiradentes/branch-context), a per-branch context folder for AI agents and humans. Sets up Git hooks, manages templates, and keeps `_branch/context.md` in sync with the active branch.

## 🚀 Quick Start

```sh
npm i -g branch-context
```

Then, inside any Git repo:

```sh
bctx init
```

This creates `.bctx/` and installs the post-checkout / post-commit hooks. `_branch/context.md` is now always pointed at the active branch's context.

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

`bctx agents status` indexes local Codex, Claude Code, and Pi sessions for the current branch.

For branch-scoped Pi sessions, install the Pi package from GitHub:

```sh
pi install git:github.com/lucasvtiradentes/branch-context
```

It records the current Git branch into new Pi session files via `pi.appendEntry()`.

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
