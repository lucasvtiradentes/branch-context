import tempfile

from branchctx.git import git_current_branch, git_init


def test_git_current_branch_empty_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        branch = git_current_branch(tmpdir)
        assert branch == "main"


def test_git_current_branch_empty_repo_custom_branch():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "develop")
        branch = git_current_branch(tmpdir)
        assert branch == "develop"


def test_git_current_branch_not_git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        branch = git_current_branch(tmpdir)
        assert branch is None
