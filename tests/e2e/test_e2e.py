import os
import tempfile

import pytest

from branchctx.assets import get_default_config
from branchctx.config import Config, get_branches_dir, get_template_dir
from branchctx.git import git_add, git_checkout, git_commit, git_config, git_init
from branchctx.hooks import install_hook
from branchctx.sync import get_branch_rel_path, sync_branch
from tests.utils import normalize_path


@pytest.fixture
def git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        git_config(tmpdir, "user.email", "test@test.com")
        git_config(tmpdir, "user.name", "Test")

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
            f.write("# Branch Context\n")

        install_hook(tmpdir)

        yield tmpdir


def test_e2e_branch_switch_preserves_content(git_repo):
    symlink_path = os.path.join(git_repo, get_default_config()["symlink"])

    sync_branch(git_repo, "main")
    assert os.path.islink(symlink_path)

    main_context = os.path.join(symlink_path, "context.md")
    with open(main_context, "w") as f:
        f.write("MAIN CONTENT")

    git_checkout(git_repo, "feature", create=True)
    sync_branch(git_repo, "feature")

    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("feature")

    feature_context = os.path.join(symlink_path, "context.md")
    with open(feature_context, "w") as f:
        f.write("FEATURE CONTENT")

    git_checkout(git_repo, "main")
    sync_branch(git_repo, "main")

    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("main")
    with open(main_context) as f:
        assert f.read() == "MAIN CONTENT"

    git_checkout(git_repo, "feature")
    sync_branch(git_repo, "feature")

    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("feature")
    with open(feature_context) as f:
        assert f.read() == "FEATURE CONTENT"


def test_e2e_multiple_branches(git_repo):
    symlink_path = os.path.join(git_repo, get_default_config()["symlink"])
    branches = ["main", "dev", "staging"]
    contents = {}

    for branch in branches:
        if branch != "main":
            git_checkout(git_repo, branch, create=True)
        else:
            git_checkout(git_repo, branch)

        sync_branch(git_repo, branch)
        contents[branch] = f"CONTENT FOR {branch.upper()}"

        with open(os.path.join(symlink_path, "context.md"), "w") as f:
            f.write(contents[branch])

    for branch in branches:
        git_checkout(git_repo, branch)
        sync_branch(git_repo, branch)

        with open(os.path.join(symlink_path, "context.md")) as f:
            assert f.read() == contents[branch]


def test_e2e_slash_branch_names(git_repo):
    symlink_path = os.path.join(git_repo, get_default_config()["symlink"])

    sync_branch(git_repo, "main")
    with open(os.path.join(symlink_path, "context.md"), "w") as f:
        f.write("MAIN")

    git_checkout(git_repo, "feature/auth/login", create=True)
    sync_branch(git_repo, "feature/auth/login")

    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("feature/auth/login")

    with open(os.path.join(symlink_path, "context.md"), "w") as f:
        f.write("FEATURE AUTH LOGIN")

    git_checkout(git_repo, "main")
    sync_branch(git_repo, "main")

    with open(os.path.join(symlink_path, "context.md")) as f:
        assert f.read() == "MAIN"
