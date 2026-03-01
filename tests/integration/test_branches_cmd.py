import os
import tempfile

import pytest

from branchctx.commands.branches import cmd_branches
from branchctx.core.sync import sync_branch
from branchctx.data.config import Config, get_branches_dir, get_template_dir
from branchctx.utils.git import git_add, git_checkout, git_commit, git_config, git_init


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


def test_branches_no_args_shows_help(git_repo, capsys):
    result = cmd_branches([])
    assert result == 1
    captured = capsys.readouterr()
    assert "usage:" in captured.out
    assert "list" in captured.out
    assert "prune" in captured.out


def test_branches_list_empty(git_repo, capsys):
    result = cmd_branches(["list"])
    assert result == 0
    captured = capsys.readouterr()
    assert "No branch contexts yet" in captured.out


def test_branches_list_with_branches(git_repo, capsys):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/test", create=True)
    sync_branch(git_repo, "feature/test")

    result = cmd_branches(["list"])
    assert result == 0
    captured = capsys.readouterr()
    assert "main" in captured.out
    assert "feature-test" in captured.out


def test_branches_list_shows_current_marker(git_repo, capsys):
    sync_branch(git_repo, "main")

    result = cmd_branches(["list"])
    assert result == 0
    captured = capsys.readouterr()
    assert "* main" in captured.out


def test_branches_prune_no_orphans(git_repo, capsys):
    sync_branch(git_repo, "main")

    result = cmd_branches(["prune"])
    assert result == 0
    captured = capsys.readouterr()
    assert "No orphan contexts to prune" in captured.out


def test_branches_prune_with_orphans(git_repo, capsys):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/old", create=True)
    sync_branch(git_repo, "feature/old")
    git_checkout(git_repo, "main")

    import subprocess

    subprocess.run(["git", "branch", "-D", "feature/old"], cwd=git_repo, capture_output=True)

    result = cmd_branches(["prune"])
    assert result == 0
    captured = capsys.readouterr()
    assert "Archiving" in captured.out
    assert "feature-old" in captured.out


def test_branches_unknown_subcommand(git_repo, capsys):
    result = cmd_branches(["unknown"])
    assert result == 1
    captured = capsys.readouterr()
    assert "error: unknown subcommand" in captured.out
