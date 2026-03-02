<a name="TOC"></a>

<h1 align="center">branch-context</h1>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

<div width="100%" align="center">
  <img src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/divider.png?raw=true" />
</div>

## 🎺 Overview<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

Git branch context manager that automatically syncs context folders across branches. Each branch gets an isolated context directory containing notes, metadata, and files that follow the branch lifecycle.

```
           git checkout feature/login
                       │
                       V
               ┌───────────────┐
               │ post-checkout │
               │    git hook   │
               └───────┬───────┘
                       │
                       V
      .bctx/branches/feature-login/ exists?
                       │
                  ┌────┴─────┐
                  │          │
                 NO         YES
                  │          │
                  V          │
            ┌──────────┐     │
            │   copy   │     │
            │ template │     │
            └─────┬────┘     │
                  │          │
                  └────┬─────┘
                       │
                       V
┌───────────────────────────────────────────┐
│ _branch -> .bctx/branches/feature-login/  │
└───────────────────────────────────────────┘
```

## ⭐ Features<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

- Branch contexts  - separate folder for each branch
- Auto-sync        - hook syncs on checkout/switch
- Templates        - new branches start from template (per-prefix support)
- Symlink          - `_branch/` always points to current branch
- Sound            - plays sound on branch switch
- Gitignored       - branch data stays local
- Shell completion - zsh, bash, fish

## 🚀 Quick Start<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

```bash
pip install branch-ctx
```

```bash
cd your-repo
bctx init                        # creates .bctx/ + installs hook

git checkout -b feature/new      # auto-creates context from template
cat _branch/context.md
```

## 📖 Usage<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

<details>
  <summary>Commands</summary>
  <br />

```bash
bctx init                          # initialize + install hook
bctx sync                          # sync context + update meta/tags
bctx status                        # show status and health
bctx branches list                 # list all branch contexts
bctx branches prune                # archive orphan contexts
bctx template                      # select template interactively
bctx template feature              # apply feature template
bctx completion zsh                # generate shell completion
bctx uninstall                     # remove hook
```

Alias: `branch-ctx` works too.

</details>

<details>
  <summary>Structure</summary>
  <br />

```
.bctx/
├── config.json
├── meta.json                # branch metadata (commits, files, timestamps)
├── templates/
│   ├── _default/            # fallback template
│   │   └── context.md
│   └── feature/             # template for feature/* branches
│       └── context.md
├── branches/                # one folder per branch (gitignored)
│   ├── main/
│   │   └── context.md
│   └── feature-login/
│       ├── context.md
│       └── base_branch      # optional per-branch base override
└── .gitignore

_branch -> .bctx/branches/main/   # symlink to current
```

</details>

<details>
  <summary>Configuration</summary>
  <br />

`.bctx/config.json`:

```json
{
  "default_base_branch": "origin/main",
  "sound": true,
  "sound_file": "/path/to/custom.wav",
  "template_rules": [
    {"prefix": "feature/", "template": "feature"},
    {"prefix": "bugfix/", "template": "bugfix"}
  ]
}
```

| Key                   | Description                                           |
|-----------------------|-------------------------------------------------------|
| `default_base_branch` | base branch for diff/commits (default: `origin/main`) |
| `sound`               | play sound on sync (default: `false`)                 |
| `sound_file`          | custom sound file (default: bundled sound)            |
| `template_rules`      | per-prefix template mapping (fallback: _default)      |

Per-branch base override: create `_branch/base_branch` with branch name.

</details>

<details>
  <summary>Shell Completion</summary>
  <br />

```bash
# zsh - add to ~/.zshrc
eval "$(bctx completion zsh)"

# bash - add to ~/.bashrc
eval "$(bctx completion bash)"

# fish
bctx completion fish | source
```

</details>

## 🤝 Contributing<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

```bash
make install    # creates venv, installs deps + pre-commit hooks
make test       # run tests
make format     # ruff fix + format
make check      # validate ruff rules
```

Manual setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```

Dev alias:

```bash
ln -sf $(pwd)/.venv/bin/bctx ~/.local/bin/bctxd   # install
rm ~/.local/bin/bctxd                             # remove
```

## 📜 License<a href="#TOC"><img align="right" src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/up_arrow.png?raw=true" width="22"></a>

This project is licensed under the [MIT License](LICENSE).

<div width="100%" align="center">
  <img src="https://github.com/lucasvtiradentes/branch-context/blob/main/.github/images/divider.png?raw=true" />
</div>

<br />

<div align="center">
  <a target="_blank" href="https://www.linkedin.com/in/lucasvtiradentes/"><img src="https://img.shields.io/badge/-linkedin-blue?logo=Linkedin&logoColor=white" alt="LinkedIn"></a>
  <a target="_blank" href="mailto:lucasvtiradentes@gmail.com"><img src="https://img.shields.io/badge/-email-red?logo=Gmail&logoColor=white" alt="Email"></a>
  <a target="_blank" href="https://github.com/lucasvtiradentes"><img src="https://img.shields.io/badge/-github-gray?logo=Github&logoColor=white" alt="GitHub"></a>
</div>
