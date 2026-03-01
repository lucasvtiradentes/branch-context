import os
import tempfile
from pathlib import Path

import pytest

from branchctx.assets import copy_init_templates
from branchctx.config import Config, TemplateRule, get_branches_dir, get_config_dir, get_templates_dir
from branchctx.constants import DEFAULT_SYMLINK, GIT_DIR
from branchctx.sync import (
    branch_context_exists,
    create_branch_context,
    get_branch_dir,
    get_branch_rel_path,
    list_branches,
    reset_branch_context,
    sync_branch,
    update_symlink,
)
from tests.utils import normalize_path


@pytest.fixture
def workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_dir = os.path.join(tmpdir, GIT_DIR)
        os.makedirs(git_dir)

        config_dir = get_config_dir(tmpdir)
        templates_dir = get_templates_dir(tmpdir)
        branches_dir = get_branches_dir(tmpdir)

        os.makedirs(config_dir)
        os.makedirs(branches_dir)

        copy_init_templates(Path(templates_dir))

        config = Config()
        config.save(tmpdir)

        yield tmpdir


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


@pytest.fixture
def workspace_no_template():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_dir = os.path.join(tmpdir, GIT_DIR)
        os.makedirs(git_dir)

        config_dir = get_config_dir(tmpdir)
        branches_dir = get_branches_dir(tmpdir)

        os.makedirs(config_dir)
        os.makedirs(branches_dir)

        config = Config()
        config.save(tmpdir)

        yield tmpdir


def test_create_branch_context_no_template(workspace_no_template):
    result = create_branch_context(workspace_no_template, "main")
    assert result == "created_empty"

    branch_dir = get_branch_dir(workspace_no_template, "main")
    assert os.path.exists(branch_dir)
    assert os.listdir(branch_dir) == []


def test_update_symlink_error_not_symlink(workspace):
    config = Config.load(workspace)
    create_branch_context(workspace, "main")

    symlink_path = os.path.join(workspace, config.symlink)
    with open(symlink_path, "w") as f:
        f.write("regular file")

    result = update_symlink(workspace, "main", config)
    assert result == "error_not_symlink"


def test_sync_branch(workspace):
    result = sync_branch(workspace, "feature/test")

    assert result["branch"] == "feature/test"
    assert "feature-test" in result["branch_dir"]
    assert result["create_result"] == "created_from_template"
    assert result["symlink_result"] == "updated"
    assert result["symlink_path"] == DEFAULT_SYMLINK

    symlink_path = os.path.join(workspace, DEFAULT_SYMLINK)
    assert os.path.islink(symlink_path)


def test_symlink_switches_between_branches(workspace):
    config = Config.load(workspace)
    symlink_path = os.path.join(workspace, config.symlink)

    create_branch_context(workspace, "main")
    create_branch_context(workspace, "feature")

    update_symlink(workspace, "main", config)
    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("main")

    update_symlink(workspace, "feature", config)
    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("feature")

    update_symlink(workspace, "main", config)
    assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path("main")


def test_branch_content_isolation(workspace):
    config = Config.load(workspace)
    symlink_path = os.path.join(workspace, config.symlink)

    sync_branch(workspace, "main")
    with open(os.path.join(symlink_path, "context.md"), "w") as f:
        f.write("MAIN CONTENT")

    sync_branch(workspace, "feature")
    with open(os.path.join(symlink_path, "context.md"), "w") as f:
        f.write("FEATURE CONTENT")

    sync_branch(workspace, "main")
    with open(os.path.join(symlink_path, "context.md")) as f:
        assert f.read() == "MAIN CONTENT"

    sync_branch(workspace, "feature")
    with open(os.path.join(symlink_path, "context.md")) as f:
        assert f.read() == "FEATURE CONTENT"


def test_multiple_branch_switches(workspace):
    config = Config.load(workspace)
    symlink_path = os.path.join(workspace, config.symlink)
    branches = ["main", "dev", "feature/a", "feature/b"]

    for branch in branches:
        result = sync_branch(workspace, branch)
        assert result["symlink_result"] in ("updated", "unchanged")
        assert os.path.islink(symlink_path)

    for _ in range(3):
        for branch in branches:
            sync_branch(workspace, branch)
            assert normalize_path(os.readlink(symlink_path)) == get_branch_rel_path(branch)


def test_create_branch_context_with_template_rules(workspace):
    config = Config(template_rules=[TemplateRule(prefix="feature/", template="feature")])
    config.save(workspace)

    result = create_branch_context(workspace, "feature/login")
    assert result == "created_from_template"

    branch_dir = get_branch_dir(workspace, "feature/login")
    with open(os.path.join(branch_dir, "context.md")) as f:
        content = f.read()
    assert "Feature:" in content


def test_reset_branch_context(workspace):
    create_branch_context(workspace, "main")
    branch_dir = get_branch_dir(workspace, "main")

    with open(os.path.join(branch_dir, "context.md"), "w") as f:
        f.write("MODIFIED CONTENT")

    result = reset_branch_context(workspace, "main")
    assert result == "reset"

    with open(os.path.join(branch_dir, "context.md")) as f:
        content = f.read()
    assert "# Branch: main" in content
    assert "MODIFIED CONTENT" not in content


def test_reset_branch_context_with_specific_template(workspace):
    create_branch_context(workspace, "main")

    result = reset_branch_context(workspace, "main", "feature")
    assert result == "reset"

    branch_dir = get_branch_dir(workspace, "main")
    with open(os.path.join(branch_dir, "context.md")) as f:
        content = f.read()
    assert "Feature:" in content
