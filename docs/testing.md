---
title: Testing
description: Test framework, patterns, and test locations
related_docs:
  - docs/repo/local-setup.md: running tests locally
  - docs/repo/cicd.md:        CI test configuration
required_docs: []
sources:
  - tests/:         test suites
  - tests/utils.py: test utilities
  - pyproject.toml: pytest configuration
---

# Testing

## Framework

- pytest 7+
- No external test dependencies beyond pytest

## Test Locations

```
tests/
├── utils.py                  Shared test utilities
├── integration/              Unit and integration tests
│   ├── test_init.py          Init command tests
│   ├── test_sync.py          Sync logic tests
│   ├── test_hooks.py         Hook installation tests
│   ├── test_config.py        Config operations tests
│   ├── test_meta.py          Meta file tests
│   ├── test_git.py           Git utils tests
│   ├── test_branches_cmd.py  Branches command tests
│   ├── test_status_cmd.py    Status command tests
│   ├── test_context_tags.py  Tag replacement tests
│   └── test_template_vars.py Template variable tests
│
└── e2e/                      End-to-end workflow tests
    ├── test_e2e.py           Full workflow tests
    ├── test_meta_e2e.py      Meta tracking e2e
    └── test_context_tags_e2e.py Tag update e2e
```

## Running Tests

All tests:
```bash
make test
```

Integration only:
```bash
pytest tests/integration -v
```

E2E only:
```bash
pytest tests/e2e -v
```

## Test Patterns

### Temporary Directory Fixture

```python
import tempfile
from pathlib import Path

def test_something():
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        # ... test logic ...
```

### Git Repository Setup

```python
from branchctx.utils.git import git_init, git_config

def create_git_repo(path: str) -> None:
    git_init(path, "main")
    git_config(path, "user.email", "test@test.com")
    git_config(path, "user.name", "Test")
```

### Integration Test Pattern

```python
def test_init_creates_config():
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        create_git_repo(workspace)

        # Run init
        os.chdir(workspace)
        result = cmd_init([])

        # Assert
        assert result == 0
        assert (workspace / ".bctx" / "config.json").exists()
```

### E2E Test Pattern

```python
def test_checkout_creates_context():
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        create_git_repo(workspace)

        # Initialize
        cmd_init([])

        # Create and switch branch
        subprocess.run(["git", "checkout", "-b", "feature/test"], cwd=workspace)

        # Trigger hook
        cmd_on_checkout(["main", "feature/test"])

        # Assert
        assert (workspace / ".bctx" / "branches" / "feature-test").exists()
        assert (workspace / "_branch").is_symlink()
```

## Test Coverage

| Module               | Test File            | Coverage Focus         |
|----------------------|----------------------|------------------------|
| cli.py               | (via integration)    | Command dispatch       |
| core/hooks.py        | test_hooks.py        | Hook install/uninstall |
| core/sync.py         | test_sync.py         | Branch sync, templates |
| core/context_tags.py | test_context_tags.py | Tag replacement        |
| data/config.py       | test_config.py       | Config read/write      |
| data/meta.py         | test_meta.py         | Meta tracking          |
| utils/git.py         | test_git.py          | Git operations         |

## CI Matrix

Integration tests run on:
- Python 3.9, 3.10, 3.11, 3.12, 3.13
- Ubuntu only

E2E tests run on:
- Python 3.12
- Ubuntu, Windows, macOS
