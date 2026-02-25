import os
import tempfile

import pytest

from branchctx.assets import get_default_config
from branchctx.config import (
    Config,
    TemplateRule,
    config_exists,
    get_branches_dir,
    get_config_dir,
    get_template_dir,
)
from branchctx.constants import BRANCHES_DIR, CONFIG_DIR, TEMPLATES_DIR


@pytest.fixture
def workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        config_dir = os.path.join(tmpdir, CONFIG_DIR)
        os.makedirs(config_dir)
        yield tmpdir


def test_get_config_dir(workspace):
    result = get_config_dir(workspace)
    assert result == os.path.join(workspace, CONFIG_DIR)


def test_get_branches_dir(workspace):
    result = get_branches_dir(workspace)
    assert result == os.path.join(workspace, CONFIG_DIR, BRANCHES_DIR)


def test_get_template_dir(workspace):
    result = get_template_dir(workspace)
    assert result == os.path.join(workspace, CONFIG_DIR, TEMPLATES_DIR, get_default_config()["default_template"])


def test_get_template_dir_custom(workspace):
    result = get_template_dir(workspace, "feature")
    assert result == os.path.join(workspace, CONFIG_DIR, TEMPLATES_DIR, "feature")


def test_config_exists_false(workspace):
    assert not config_exists(workspace)


def test_config_exists_true(workspace):
    config = Config()
    config.save(workspace)
    assert config_exists(workspace)


def test_config_default_values():
    defaults = get_default_config()
    config = Config()
    assert config.symlink == defaults["symlink"]
    assert config.on_switch is None


def test_config_save_and_load(workspace):
    config = Config(
        symlink=".my-context",
        on_switch="echo {branch}",
    )
    config.save(workspace)

    loaded = Config.load(workspace)
    assert loaded.symlink == ".my-context"
    assert loaded.on_switch == "echo {branch}"


def test_config_load_missing_file(workspace):
    defaults = get_default_config()
    config = Config.load(workspace)
    assert config.symlink == defaults["symlink"]
    assert config.on_switch is None


def test_config_template_rules(workspace):
    config = Config(
        template_rules=[
            TemplateRule(prefix="feature/", template="feature"),
            TemplateRule(prefix="bugfix/", template="bugfix"),
        ]
    )
    config.save(workspace)

    loaded = Config.load(workspace)
    assert len(loaded.template_rules) == 2
    assert loaded.template_rules[0].prefix == "feature/"
    assert loaded.template_rules[0].template == "feature"


def test_config_get_template_for_branch():
    defaults = get_default_config()
    config = Config(
        template_rules=[
            TemplateRule(prefix="feature/", template="feature"),
            TemplateRule(prefix="bugfix/", template="bugfix"),
        ]
    )

    assert config.get_template_for_branch("feature/login") == "feature"
    assert config.get_template_for_branch("bugfix/123") == "bugfix"
    assert config.get_template_for_branch("main") == defaults["default_template"]
    assert config.get_template_for_branch("develop") == defaults["default_template"]
