import os
import tempfile

import pytest

from branchctx.commands.status import cmd_status
from branchctx.constants import HOOK_POST_CHECKOUT
from branchctx.core.hooks import install_hook
from branchctx.core.sync import sync_branch
from branchctx.data.config import Config, get_branches_dir, get_template_dir
from branchctx.utils.git import git_add, git_commit, git_config, git_init


@pytest.fixture
def git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        git_config(tmpdir, "user.email", "test@test.com")
        git_config(tmpdir, "user.name", "Test User")

        readme = os.path.join(tmpdir, "README.md")
        with open(readme, "w") as f:
            f.write("# Test")

        git_add(tmpdir)
        git_commit(tmpdir, "init")

        template_dir = get_template_dir(tmpdir)
        branches_dir = get_branches_dir(tmpdir)

        os.makedirs(template_dir)
        os.makedirs(branches_dir)

        config = Config()
        config.save(tmpdir)

        with open(os.path.join(template_dir, "context.md"), "w") as f:
            f.write("# Context")

        original_cwd = os.getcwd()
        os.chdir(tmpdir)
        yield tmpdir
        os.chdir(original_cwd)


def test_status_not_initialized(capsys):
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        original_cwd = os.getcwd()
        os.chdir(tmpdir)
        try:
            result = cmd_status([])
            assert result == 1
            captured = capsys.readouterr()
            assert "not initialized" in captured.out
        finally:
            os.chdir(original_cwd)


def test_status_shows_repository(git_repo, capsys):
    cmd_status([])
    captured = capsys.readouterr()
    assert "Repository:" in captured.out
    assert git_repo in captured.out


def test_status_shows_branch(git_repo, capsys):
    cmd_status([])
    captured = capsys.readouterr()
    assert "Branch:" in captured.out
    assert "main" in captured.out


def test_status_shows_hooks_none(git_repo, capsys):
    cmd_status([])
    captured = capsys.readouterr()
    assert "Hooks:" in captured.out


def test_status_shows_hooks_installed(git_repo, capsys):
    install_hook(git_repo, HOOK_POST_CHECKOUT)
    cmd_status([])
    captured = capsys.readouterr()
    assert "post-checkout" in captured.out


def test_status_shows_templates(git_repo, capsys):
    cmd_status([])
    captured = capsys.readouterr()
    assert "Templates:" in captured.out
    assert "_default" in captured.out


def test_status_shows_contexts_count(git_repo, capsys):
    sync_branch(git_repo, "main")
    cmd_status([])
    captured = capsys.readouterr()
    assert "Contexts:" in captured.out
    assert "1 branches" in captured.out


def test_status_shows_health_section(git_repo, capsys):
    install_hook(git_repo, HOOK_POST_CHECKOUT)
    sync_branch(git_repo, "main")
    cmd_status([])
    captured = capsys.readouterr()
    assert "Health:" in captured.out
    assert "[ok]" in captured.out


def test_status_shows_symlink_not_set(git_repo, capsys):
    cmd_status([])
    captured = capsys.readouterr()
    assert "Symlink:" in captured.out
    assert "not set" in captured.out


def test_status_shows_symlink_valid(git_repo, capsys):
    sync_branch(git_repo, "main")
    cmd_status([])
    captured = capsys.readouterr()
    assert "Symlink:" in captured.out
    assert "->" in captured.out


def test_status_returns_error_when_hook_missing(git_repo, capsys):
    sync_branch(git_repo, "main")
    result = cmd_status([])
    assert result == 1
    captured = capsys.readouterr()
    assert "[!!]" in captured.out
    assert "post-checkout" in captured.out
