# branch-context

Git branch context manager - sync context folders across branches automatically.

```
           git checkout feature/login
                       │
                       ▼
               ┌───────────────┐
               │ post-checkout │
               │    git hook   │
               └───────┬───────┘
                       │
                       ▼
      .bctx/branches/feature-login/ exists?
                       │
                 ┌─────┴─────┐
                 │           │
                NO          YES
                 │           │
                 ▼           │
            ┌─────────┐      │
            │  copy   │      │
            │template │      │
            └────┬────┘      │
                 │           │
                 └─────┬─────┘
                       │
                       ▼
┌───────────────────────────────────────────┐
│ _branch -> .bctx/branches/feature-login/ │
└───────────────────────────────────────────┘
```

## Features

- branch contexts   - separate folder for each branch
- auto-sync         - hook syncs on checkout/switch
- templates         - new branches start from template (per-prefix support)
- symlink           - `_branch/` always points to current branch
- sound             - plays sound on branch switch
- gitignored        - branch data stays local
- shell completion  - zsh, bash, fish

## Install

```bash
pip install branch-ctx
```

## Commands

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

## Quick Start

```bash
pip install bctx

cd your-repo
bctx init      # creates .bctx/ + installs hook

git checkout -b feature/new   # auto-creates context from template
cat _branch/context.md
```

## Shell Completion

```bash
# zsh - add to ~/.zshrc
eval "$(bctx completion zsh)"

# bash - add to ~/.bashrc
eval "$(bctx completion bash)"

# fish
bctx completion fish | source
```

## Structure

```
.bctx/
├── config.json
├── templates/
│   ├── _default/            # fallback template
│   │   └── context.md
│   └── feature/             # template for feature/* branches
│       └── context.md
├── branches/                # one folder per branch (gitignored)
│   ├── main/
│   │   └── context.md
│   └── feature-login/
│       └── context.md
└── .gitignore

_branch -> .bctx/branches/main/   # symlink to current
```

## Config

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

| Key                 | Description                                      |
|---------------------|--------------------------------------------------|
| `default_base_branch` | base branch for diff/commits (default: `origin/main`) |
| `sound`             | play sound on sync (default: `false`)            |
| `sound_file`        | custom sound file (default: bundled sound)       |
| `template_rules`    | per-prefix template mapping (fallback: _default) |

Per-branch base override: create `_branch/base_branch` with branch name.

## Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```

```bash
# dev alias (bctxd)
ln -sf $(pwd)/.venv/bin/bctx ~/.local/bin/bctxd   # install
rm ~/.local/bin/bctxd                             # remove
```