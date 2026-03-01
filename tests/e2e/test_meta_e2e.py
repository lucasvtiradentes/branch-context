import json
import os
import tempfile

import pytest

from branchctx.commands.on_checkout import cmd_on_checkout
from branchctx.commands.on_commit import cmd_on_commit
from branchctx.commands.template import cmd_template
from branchctx.constants import DEFAULT_SYMLINK, HOOK_POST_CHECKOUT, HOOK_POST_COMMIT
from branchctx.core.hooks import install_hook
from branchctx.core.sync import archive_branch, sanitize_branch_name, sync_branch
from branchctx.data.config import get_branches_dir, get_config_dir, get_template_dir
from branchctx.data.meta import get_branch_meta, load_archived_meta
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

        config_dir = get_config_dir(tmpdir)
        os.makedirs(template_dir)
        os.makedirs(branches_dir)

        config_data = {"default_base_branch": "main", "sound": False, "template_rules": []}
        with open(os.path.join(config_dir, "config.json"), "w") as f:
            json.dump(config_data, f)

        with open(os.path.join(template_dir, "context.md"), "w") as f:
            f.write("# Context\n<bctx:commits></bctx:commits>\n<bctx:files></bctx:files>")

        install_hook(tmpdir, HOOK_POST_CHECKOUT)
        install_hook(tmpdir, HOOK_POST_COMMIT)

        original_cwd = os.getcwd()
        os.chdir(tmpdir)
        yield tmpdir
        os.chdir(original_cwd)


def test_on_checkout_creates_and_updates_meta(git_repo):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/test", create=True)

    cmd_on_checkout(["main", "feature/test"])

    branch_key = sanitize_branch_name("feature/test")
    meta = get_branch_meta(git_repo, branch_key)

    assert meta is not None
    assert meta["branch"] == "feature/test"
    assert meta["author"] == "Test User"


def test_on_commit_updates_meta(git_repo):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/commit-test", create=True)
    cmd_on_checkout(["main", "feature/commit-test"])

    test_file = os.path.join(git_repo, "new_file.py")
    with open(test_file, "w") as f:
        f.write("print('hello')")

    git_add(git_repo)
    git_commit(git_repo, "feat: add file")

    cmd_on_commit([])

    branch_key = sanitize_branch_name("feature/commit-test")
    meta = get_branch_meta(git_repo, branch_key)

    assert meta["last_commit"]["message"] == "feat: add file"
    assert "feat: add file" in meta["commits"]


def test_on_commit_updates_context_tags(git_repo):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/tags-test", create=True)
    sync_branch(git_repo, "feature/tags-test")
    cmd_on_checkout(["main", "feature/tags-test"])

    test_file = os.path.join(git_repo, "test.py")
    with open(test_file, "w") as f:
        f.write("print('test')")

    git_add(git_repo)
    git_commit(git_repo, "feat: test commit")

    cmd_on_commit([])

    context_file = os.path.join(git_repo, DEFAULT_SYMLINK, "context.md")
    with open(context_file) as f:
        content = f.read()

    assert "feat: test commit" in content
    assert "test.py" in content


def test_template_preserves_meta_data(git_repo):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/template-test", create=True)
    sync_branch(git_repo, "feature/template-test")
    cmd_on_checkout(["main", "feature/template-test"])

    test_file = os.path.join(git_repo, "file.py")
    with open(test_file, "w") as f:
        f.write("x = 1")

    git_add(git_repo)
    git_commit(git_repo, "feat: add file")
    cmd_on_commit([])

    branch_key = sanitize_branch_name("feature/template-test")
    meta_before = get_branch_meta(git_repo, branch_key)

    cmd_template(["_default"])

    meta_after = get_branch_meta(git_repo, branch_key)
    assert meta_after["commits"] == meta_before["commits"]
    assert meta_after["changed_files"] == meta_before["changed_files"]

    context_file = os.path.join(git_repo, DEFAULT_SYMLINK, "context.md")
    with open(context_file) as f:
        content = f.read()

    assert "feat: add file" in content


def test_prune_moves_meta_to_archived(git_repo):
    sync_branch(git_repo, "main")
    git_checkout(git_repo, "feature/to-prune", create=True)
    sync_branch(git_repo, "feature/to-prune")
    cmd_on_checkout(["main", "feature/to-prune"])

    branch_key = sanitize_branch_name("feature/to-prune")
    assert get_branch_meta(git_repo, branch_key) is not None

    archive_branch(git_repo, branch_key)

    assert get_branch_meta(git_repo, branch_key) is None

    archived = load_archived_meta(git_repo)
    assert branch_key in archived
    assert archived[branch_key]["branch"] == "feature/to-prune"
