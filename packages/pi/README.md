# Branch Context Pi package

Records the current Git branch into Pi session files so Branch Context can index Pi sessions per branch.

## Install

From GitHub:

```sh
pi install git:github.com/lucasvtiradentes/branch-context
```

For local development from this repository:

```sh
pi install ./packages/pi
```

Then start a new Pi session inside a Git repo:

```sh
pi
```

The extension writes a hidden Pi custom entry:

```json
{
  "type": "custom",
  "customType": "branch-context",
  "data": {
    "cwd": "/repo",
    "repoRoot": "/repo",
    "gitBranch": "feature/example",
    "recordedAt": "2026-05-01T10:00:00.000Z"
  }
}
```

Detached HEAD / non-Git directories are ignored.
