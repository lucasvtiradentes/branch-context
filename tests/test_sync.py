import os
import tempfile

import pytest

from omnicontext.config import Config, get_branches_dir, get_config_dir, get_template_dir
from omnicontext.constants import DEFAULT_TEMPLATE_CONTEXT
from omnicontext.sync import (
    branch_context_exists,
    create_branch_context,
    get_branch_dir,
    list_branches,
    sanitize_branch_name,
    update_symlink,
)


@pytest.fixture
def workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_dir = os.path.join(tmpdir, ".git")
        os.makedirs(git_dir)

        config_dir = get_config_dir(tmpdir)
        template_dir = get_template_dir(tmpdir)
        branches_dir = get_branches_dir(tmpdir)

        os.makedirs(config_dir)
        os.makedirs(template_dir)
        os.makedirs(branches_dir)

        config = Config()
        config.save(tmpdir)

        with open(os.path.join(template_dir, "context.md"), "w") as f:
            f.write(DEFAULT_TEMPLATE_CONTEXT)

        yield tmpdir


def test_sanitize_branch_name():
    assert sanitize_branch_name("main") == "main"
    assert sanitize_branch_name("feature/login") == "feature-login"
    assert sanitize_branch_name("feature/auth/oauth") == "feature-auth-oauth"


def test_create_branch_context_from_template(workspace):
    result = create_branch_context(workspace, "main")
    assert result == "created_from_template"

    branch_dir = get_branch_dir(workspace, "main")
    assert os.path.exists(branch_dir)
    assert os.path.exists(os.path.join(branch_dir, "context.md"))


def test_create_branch_context_exists(workspace):
    create_branch_context(workspace, "main")
    result = create_branch_context(workspace, "main")
    assert result == "exists"


def test_branch_context_exists(workspace):
    assert not branch_context_exists(workspace, "main")
    create_branch_context(workspace, "main")
    assert branch_context_exists(workspace, "main")


def test_update_symlink(workspace):
    config = Config.load(workspace)
    create_branch_context(workspace, "main")

    result = update_symlink(workspace, "main", config)
    assert result == "updated"

    symlink_path = os.path.join(workspace, config.symlink)
    assert os.path.islink(symlink_path)


def test_update_symlink_unchanged(workspace):
    config = Config.load(workspace)
    create_branch_context(workspace, "main")

    update_symlink(workspace, "main", config)
    result = update_symlink(workspace, "main", config)
    assert result == "unchanged"


def test_list_branches(workspace):
    assert list_branches(workspace) == []

    create_branch_context(workspace, "main")
    create_branch_context(workspace, "feature/login")

    branches = list_branches(workspace)
    assert "main" in branches
    assert "feature-login" in branches
    assert len(branches) == 2
