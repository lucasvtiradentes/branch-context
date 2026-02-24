# branch-context

Git branch context manager - sync context folders across branches automatically.

```
git checkout feature/login
        │
        ▼
   post-checkout hook
        │
        ▼
   .bctx/branches/feature-login/ exists?
        │
   ┌────┴────┐
   │ NO      │ YES
   ▼         ▼
 copy       use
 template   existing
        │
        ▼
   symlink .branch-context -> .bctx/branches/feature-login/
```

## Features

- branch contexts   - separate folder for each branch
- auto-sync         - hook syncs on checkout/switch
- templates         - new branches start from template (per-prefix support)
- symlink           - `.branch-context/` always points to current branch
- sound             - plays sound on branch switch
- gitignored        - branch data stays local
- shell completion  - zsh, bash, fish

## Install

```bash
pip install branch-ctx
```

## Commands

```bash
branch-ctx init                          # initialize + install hook
branch-ctx sync                          # sync current branch manually
branch-ctx branches                      # list all branch contexts
branch-ctx status                        # show status
branch-ctx reset                         # reset context to template
branch-ctx reset feature                 # reset to specific template
branch-ctx doctor                        # run diagnostics
branch-ctx completion zsh                # generate shell completion
branch-ctx uninstall                     # remove hook
```

Alias: `bctx` works too.

## Quick Start

```bash
pip install branch-ctx

cd your-repo
branch-ctx init      # creates .bctx/ + installs hook

git checkout -b feature/new   # auto-creates context from template
cat .branch-context/context.md
```

## Shell Completion

```bash
# zsh - add to ~/.zshrc
eval "$(branch-ctx completion zsh)"

# bash - add to ~/.bashrc
eval "$(branch-ctx completion bash)"

# fish
branch-ctx completion fish | source
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

.branch-context -> .bctx/branches/main/   # symlink to current
```

## Config

`.bctx/config.json`:

```json
{
  "symlink": ".branch-context",
  "on_switch": "echo 'switched to {branch}'",
  "sound": true,
  "sound_file": "/path/to/custom.wav",
  "template_rules": [
    {"prefix": "feature/", "template": "feature"},
    {"prefix": "bugfix/", "template": "bugfix"}
  ]
}
```

| Key              | Description                                      |
|------------------|--------------------------------------------------|
| `symlink`        | symlink name (default: `.branch-context`)        |
| `on_switch`      | command to run on branch switch                  |
| `sound`          | play sound on sync (default: `false`)            |
| `sound_file`     | custom sound file (default: bundled sound)       |
| `template_rules` | per-prefix template mapping (fallback: _default) |

## Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```
