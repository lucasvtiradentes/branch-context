# omnicontext

Git branch context manager - sync context folders across branches automatically.

```
git checkout feature/login
        │
        ▼
   post-checkout hook
        │
        ▼
   .omnicontext/branches/feature-login/ exists?
        │
   ┌────┴────┐
   │ NO      │ YES
   ▼         ▼
 copy       use
 template/  existing
        │
        ▼
   symlink .branch-context -> .omnicontext/branches/feature-login/
```

## Features

- branch contexts   - separate folder for each branch
- auto-sync         - hook syncs on checkout/switch
- templates         - new branches start from template
- symlink           - `.branch-context/` always points to current branch
- gitignored        - branch data stays local

## Commands

```bash
omnicontext init                             # initialize .omnicontext/
omnicontext install                          # install post-checkout hook
omnicontext install --global                 # global hooks path
omnicontext sync                             # sync current branch manually
omnicontext branches                         # list all branch contexts
omnicontext status                           # show status
omnicontext uninstall                        # remove hook
```

## Quick Start

```bash
pip install omnicontext

cd your-repo
omnicontext init      # creates .omnicontext/
omnicontext install   # installs hook

git checkout -b feature/new   # auto-creates context from template
cat .branch-context/context.md
```

## Structure

```
.omnicontext/
├── config.json              # settings
├── template/                # copied to new branches
│   └── context.md
├── branches/                # one folder per branch (gitignored)
│   ├── main/
│   │   └── context.md
│   └── feature-login/
│       └── context.md
└── .gitignore

.branch-context -> .omnicontext/branches/main/   # symlink to current
```

## Config

`.omnicontext/config.json`:

```json
{
  "symlink": ".branch-context",
  "on_switch": "echo 'switched to {branch}'"
}
```

| Key | Description |
|-----|-------------|
| `symlink` | symlink name (default: `.branch-context`) |
| `on_switch` | command to run on branch switch |

## Install

```bash
pipx install omnicontext
# pip install omnicontext
```

## Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```
