import os
import tempfile

import pytest

from omnicontext.constants import GIT_DIR, HOOK_MARKER
from omnicontext.hooks import get_hook_path, install_hook, is_hook_installed, uninstall_hook


@pytest.fixture
def git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_dir = os.path.join(tmpdir, GIT_DIR)
        hooks_dir = os.path.join(git_dir, "hooks")
        os.makedirs(hooks_dir)
        yield tmpdir


def test_install_hook(git_repo):
    result = install_hook(git_repo)
    assert result == "installed"

    hook_path = get_hook_path(git_repo)
    assert os.path.exists(hook_path)

    with open(hook_path) as f:
        content = f.read()
    assert HOOK_MARKER in content


def test_install_hook_already_installed(git_repo):
    install_hook(git_repo)
    result = install_hook(git_repo)
    assert result == "already_installed"


def test_install_hook_exists_not_managed(git_repo):
    hook_path = get_hook_path(git_repo)
    with open(hook_path, "w") as f:
        f.write("#!/bin/bash\necho 'existing hook'")

    result = install_hook(git_repo)
    assert result == "hook_exists"


def test_is_hook_installed(git_repo):
    assert not is_hook_installed(git_repo)
    install_hook(git_repo)
    assert is_hook_installed(git_repo)


def test_uninstall_hook(git_repo):
    install_hook(git_repo)
    result = uninstall_hook(git_repo)
    assert result == "uninstalled"

    hook_path = get_hook_path(git_repo)
    assert not os.path.exists(hook_path)


def test_uninstall_hook_not_installed(git_repo):
    result = uninstall_hook(git_repo)
    assert result == "not_installed"


def test_uninstall_hook_not_managed(git_repo):
    hook_path = get_hook_path(git_repo)
    with open(hook_path, "w") as f:
        f.write("#!/bin/bash\necho 'existing hook'")

    result = uninstall_hook(git_repo)
    assert result == "not_managed"
