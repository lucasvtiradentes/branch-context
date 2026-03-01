import os
import tempfile

import pytest

from branchctx.constants import BRANCHES_DIR, CONFIG_DIR, DEFAULT_TEMPLATE, TEMPLATES_DIR
from branchctx.data.config import (
    Config,
    TemplateRule,
    config_exists,
    get_branches_dir,
    get_config_dir,
    get_template_dir,
)


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
    assert result == os.path.join(workspace, CONFIG_DIR, TEMPLATES_DIR, DEFAULT_TEMPLATE)


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
    config = Config()
    assert config.sound is False


def test_config_save_and_load(workspace):
    config = Config(sound=True)
    config.save(workspace)

    loaded = Config.load(workspace)
    assert loaded.sound is True


def test_config_load_missing_file(workspace):
    config = Config.load(workspace)
    assert config.sound is False


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
    config = Config(
        template_rules=[
            TemplateRule(prefix="feature/", template="feature"),
            TemplateRule(prefix="bugfix/", template="bugfix"),
        ]
    )

    assert config.get_template_for_branch("feature/login") == "feature"
    assert config.get_template_for_branch("bugfix/123") == "bugfix"
    assert config.get_template_for_branch("main") == DEFAULT_TEMPLATE
    assert config.get_template_for_branch("develop") == DEFAULT_TEMPLATE
