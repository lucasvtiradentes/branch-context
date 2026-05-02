<a name="TOC"></a>

<div align="center">
  <!-- <DYNFIELD:HEADER_LOGO> -->
  <img height="80" src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/apps/vscode-extension/resources/icon-colored.png" alt="branch-context logo">
  <!-- </DYNFIELD:HEADER_LOGO> -->
  <div>Branch Context for VS Code</div>
  <br />
  <a href="https://marketplace.visualstudio.com/items?itemName=lucasvtiradentes.branch-context-vscode"><img src="https://img.shields.io/badge/VS%20Code-Extension-blue.svg" alt="VS Marketplace"></a>
  <a href="https://open-vsx.org/extension/lucasvtiradentes/branch-context-vscode"><img src="https://img.shields.io/open-vsx/v/lucasvtiradentes/branch-context-vscode?label=Open%20VSX&labelColor=a60ee5&color=374151" alt="Open VSX"></a>
  <br /><br />
  <a href="#-overview">Overview</a> • <a href="#-features">Features</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-configuration">Configuration</a> • <a href="#-license">License</a>
</div>

<!-- <DYNFIELD:TOP_DIVIDER> -->
<div width="100%" align="center">
  <img src="https://cdn.jsdelivr.net/gh/lucasvtiradentes/branch-context@main/.github/image/divider.png" />
</div>
<!-- </DYNFIELD:TOP_DIVIDER> -->

## 🎯 Overview

VS Code extension for [Branch Context](https://github.com/lucasvtiradentes/branch-context). Adds a sidebar with the current branch's context, git changes, templates, and AI session pointers, all scoped to the active branch.

## ⭐ Features

- Sidebar (activity bar) with five views:
  - Branch Context, current `context.md` outline and quick actions
  - Branch AI Sessions, indexed Codex / Claude Code sessions with resume, active state, pinning, grouping, source-file open, and delete actions
  - Branch Git Changes, files and commits on the current branch
  - Other Branches, list, checkout, archive, and restore contexts
  - Templates, apply per-branch templates
- Status bar entry with current branch and context state
- CodeLens, decorations, and document symbols inside `context.md`
- Commands for sync, status, set base, apply template, review diff, and more
- CLI compatibility checks with update prompts when the installed CLI does not match the extension

## 🚀 Quick Start

1. Install the CLI and run `bctx init` in your repo (see [main README](https://github.com/lucasvtiradentes/branch-context#-quick-start)).
2. Install this extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lucasvtiradentes.branch-context-vscode) or [Open VSX](https://open-vsx.org/extension/lucasvtiradentes/branch-context-vscode).

## ⚙️ Configuration

Default `.bctx/config.json`:

<!-- <DYNFIELD:CONFIG_JSON> -->
```json
{
  "default_base_branch": "main",
  "sound": true,
  "commit_description": false,
  "template_rules": [
    {
      "prefix": "feature/",
      "template": "feature"
    },
    {
      "prefix": "fix/",
      "template": "fix"
    }
  ]
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
