import os
import tempfile

import pytest

from omnicontext.config import (
    Config,
    SyncConfig,
    config_exists,
    get_branches_dir,
    get_config_dir,
    get_template_dir,
)
from omnicontext.constants import CONFIG_DIR


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
    assert result == os.path.join(workspace, CONFIG_DIR, "branches")


def test_get_template_dir(workspace):
    result = get_template_dir(workspace)
    assert result == os.path.join(workspace, CONFIG_DIR, "template")


def test_config_exists_false(workspace):
    assert not config_exists(workspace)


def test_config_exists_true(workspace):
    config = Config()
    config.save(workspace)
    assert config_exists(workspace)


def test_config_default_values():
    config = Config()
    assert config.symlink == ".branch-context"
    assert config.on_switch is None
    assert config.sync.provider == "local"


def test_config_save_and_load(workspace):
    config = Config(
        symlink=".my-context",
        on_switch="echo {branch}",
        sync=SyncConfig(provider="gcp", gcp_bucket="my-bucket"),
    )
    config.save(workspace)

    loaded = Config.load(workspace)
    assert loaded.symlink == ".my-context"
    assert loaded.on_switch == "echo {branch}"
    assert loaded.sync.provider == "gcp"
    assert loaded.sync.gcp_bucket == "my-bucket"


def test_config_load_missing_file(workspace):
    config = Config.load(workspace)
    assert config.symlink == ".branch-context"
    assert config.on_switch is None
