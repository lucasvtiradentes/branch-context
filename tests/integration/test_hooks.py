import os
import tempfile
from unittest.mock import patch

import pytest

from branchctx.constants import GIT_DIR, HOOK_MARKER, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT
from branchctx.core.hooks import (
    _reset_confirmation_state,
    get_hook_path,
    install_hook,
    is_hook_installed,
    uninstall_hook,
)


@pytest.fixture
def git_repo():
    _reset_confirmation_state()
    with tempfile.TemporaryDirectory() as tmpdir:
        git_dir = os.path.join(tmpdir, GIT_DIR)
        hooks_dir = os.path.join(git_dir, "hooks")
        os.makedirs(hooks_dir)
        yield tmpdir
    _reset_confirmation_state()


class TestPostCheckoutHook:
    def test_install_hook(self, git_repo):
        result = install_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "installed"

        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        assert os.path.exists(hook_path)

        with open(hook_path) as f:
            content = f.read()
        assert HOOK_MARKER in content
        assert "on-checkout" in content

    def test_install_hook_already_installed(self, git_repo):
        install_hook(git_repo, HOOK_POST_CHECKOUT)
        result = install_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "already_installed"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=False)
    def test_install_hook_exists_not_managed(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = install_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "hook_exists"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=True)
    def test_install_hook_appended(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = install_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "appended"

        with open(hook_path) as f:
            content = f.read()
        assert "existing hook" in content
        assert HOOK_MARKER in content
        assert "on-checkout" in content

    def test_is_hook_installed(self, git_repo):
        assert not is_hook_installed(git_repo, HOOK_POST_CHECKOUT)
        install_hook(git_repo, HOOK_POST_CHECKOUT)
        assert is_hook_installed(git_repo, HOOK_POST_CHECKOUT)

    def test_uninstall_hook(self, git_repo):
        install_hook(git_repo, HOOK_POST_CHECKOUT)
        result = uninstall_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "uninstalled"

        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        assert not os.path.exists(hook_path)

    def test_uninstall_hook_not_installed(self, git_repo):
        result = uninstall_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "not_installed"

    def test_uninstall_hook_not_managed(self, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = uninstall_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "not_managed"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=True)
    def test_uninstall_appended_hook(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_CHECKOUT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        install_hook(git_repo, HOOK_POST_CHECKOUT)
        result = uninstall_hook(git_repo, HOOK_POST_CHECKOUT)
        assert result == "uninstalled"

        with open(hook_path) as f:
            content = f.read()
        assert "existing hook" in content
        assert HOOK_MARKER not in content


class TestPostCommitHook:
    def test_install_hook(self, git_repo):
        result = install_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "installed"

        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        assert os.path.exists(hook_path)

        with open(hook_path) as f:
            content = f.read()
        assert HOOK_MARKER in content
        assert "on-commit" in content

    def test_install_hook_already_installed(self, git_repo):
        install_hook(git_repo, HOOK_POST_COMMIT)
        result = install_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "already_installed"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=False)
    def test_install_hook_exists_not_managed(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = install_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "hook_exists"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=True)
    def test_install_hook_appended(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = install_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "appended"

        with open(hook_path) as f:
            content = f.read()
        assert "existing hook" in content
        assert HOOK_MARKER in content
        assert "on-commit" in content

    def test_is_hook_installed(self, git_repo):
        assert not is_hook_installed(git_repo, HOOK_POST_COMMIT)
        install_hook(git_repo, HOOK_POST_COMMIT)
        assert is_hook_installed(git_repo, HOOK_POST_COMMIT)

    def test_uninstall_hook(self, git_repo):
        install_hook(git_repo, HOOK_POST_COMMIT)
        result = uninstall_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "uninstalled"

        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        assert not os.path.exists(hook_path)

    def test_uninstall_hook_not_installed(self, git_repo):
        result = uninstall_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "not_installed"

    def test_uninstall_hook_not_managed(self, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        result = uninstall_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "not_managed"

    @patch("branchctx.core.hooks._prompt_yes_no", return_value=True)
    def test_uninstall_appended_hook(self, mock_prompt, git_repo):
        hook_path = get_hook_path(git_repo, HOOK_POST_COMMIT)
        with open(hook_path, "w") as f:
            f.write("#!/bin/bash\necho 'existing hook'")

        install_hook(git_repo, HOOK_POST_COMMIT)
        result = uninstall_hook(git_repo, HOOK_POST_COMMIT)
        assert result == "uninstalled"

        with open(hook_path) as f:
            content = f.read()
        assert "existing hook" in content
        assert HOOK_MARKER not in content


class TestBothHooks:
    def test_install_both_hooks(self, git_repo):
        checkout_result = install_hook(git_repo, HOOK_POST_CHECKOUT)
        commit_result = install_hook(git_repo, HOOK_POST_COMMIT)

        assert checkout_result == "installed"
        assert commit_result == "installed"

        assert is_hook_installed(git_repo, HOOK_POST_CHECKOUT)
        assert is_hook_installed(git_repo, HOOK_POST_COMMIT)

    def test_uninstall_both_hooks(self, git_repo):
        install_hook(git_repo, HOOK_POST_CHECKOUT)
        install_hook(git_repo, HOOK_POST_COMMIT)

        checkout_result = uninstall_hook(git_repo, HOOK_POST_CHECKOUT)
        commit_result = uninstall_hook(git_repo, HOOK_POST_COMMIT)

        assert checkout_result == "uninstalled"
        assert commit_result == "uninstalled"

        assert not is_hook_installed(git_repo, HOOK_POST_CHECKOUT)
        assert not is_hook_installed(git_repo, HOOK_POST_COMMIT)

    def test_hooks_are_independent(self, git_repo):
        install_hook(git_repo, HOOK_POST_CHECKOUT)

        assert is_hook_installed(git_repo, HOOK_POST_CHECKOUT)
        assert not is_hook_installed(git_repo, HOOK_POST_COMMIT)

        install_hook(git_repo, HOOK_POST_COMMIT)
        uninstall_hook(git_repo, HOOK_POST_CHECKOUT)

        assert not is_hook_installed(git_repo, HOOK_POST_CHECKOUT)
        assert is_hook_installed(git_repo, HOOK_POST_COMMIT)
