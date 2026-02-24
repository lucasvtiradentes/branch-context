import os
import tempfile

from branchctx.commands.init import _add_to_gitignore, cmd_init
from branchctx.constants import DEFAULT_SYMLINK
from branchctx.git import git_init


def test_add_to_gitignore_creates_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        gitignore = os.path.join(tmpdir, ".gitignore")
        assert not os.path.exists(gitignore)

        _add_to_gitignore(tmpdir, "_context")

        assert os.path.exists(gitignore)
        with open(gitignore) as f:
            assert f.read() == "_context\n"


def test_add_to_gitignore_appends():
    with tempfile.TemporaryDirectory() as tmpdir:
        gitignore = os.path.join(tmpdir, ".gitignore")
        with open(gitignore, "w") as f:
            f.write("node_modules/\n.env\n")

        _add_to_gitignore(tmpdir, "_context")

        with open(gitignore) as f:
            content = f.read()
        assert content == "node_modules/\n.env\n_context\n"


def test_add_to_gitignore_no_duplicate():
    with tempfile.TemporaryDirectory() as tmpdir:
        gitignore = os.path.join(tmpdir, ".gitignore")
        with open(gitignore, "w") as f:
            f.write("_context\n")

        _add_to_gitignore(tmpdir, "_context")

        with open(gitignore) as f:
            content = f.read()
        assert content == "_context\n"


def test_add_to_gitignore_handles_no_trailing_newline():
    with tempfile.TemporaryDirectory() as tmpdir:
        gitignore = os.path.join(tmpdir, ".gitignore")
        with open(gitignore, "w") as f:
            f.write("node_modules/")

        _add_to_gitignore(tmpdir, "_context")

        with open(gitignore) as f:
            content = f.read()
        assert content == "node_modules/\n_context\n"


def test_init_creates_symlink():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        old_cwd = os.getcwd()
        try:
            os.chdir(tmpdir)
            cmd_init([])
            symlink = os.path.join(tmpdir, DEFAULT_SYMLINK)
            assert os.path.islink(symlink)
        finally:
            os.chdir(old_cwd)


def test_init_adds_to_gitignore():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        old_cwd = os.getcwd()
        try:
            os.chdir(tmpdir)
            cmd_init([])
            gitignore = os.path.join(tmpdir, ".gitignore")
            with open(gitignore) as f:
                content = f.read()
            assert DEFAULT_SYMLINK in content
        finally:
            os.chdir(old_cwd)
