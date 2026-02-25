import tempfile

import pytest

from branchctx.git import git_config, git_init
from branchctx.template_vars import get_template_variables, render_template_content


@pytest.fixture
def git_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        git_init(tmpdir, "main")
        git_config(tmpdir, "user.name", "Test User")
        git_config(tmpdir, "user.email", "test@test.com")
        yield tmpdir


def test_get_template_variables_branch():
    variables = get_template_variables("feature/login")
    assert variables["branch"] == "feature/login"


def test_get_template_variables_date():
    variables = get_template_variables("main")
    assert "date" in variables
    assert len(variables["date"]) == 10
    assert "-" in variables["date"]


def test_get_template_variables_author(git_repo):
    import os

    original_cwd = os.getcwd()
    os.chdir(git_repo)
    try:
        variables = get_template_variables("main")
        assert variables["author"] == "Test User"
    finally:
        os.chdir(original_cwd)


def test_render_template_content_branch():
    content = "# Branch: {{branch}}"
    variables = {"branch": "feature/test", "date": "2026-01-01", "author": "Me"}
    result = render_template_content(content, variables)
    assert result == "# Branch: feature/test"


def test_render_template_content_all_vars():
    content = "Branch: {{branch}}\nDate: {{date}}\nAuthor: {{author}}"
    variables = {"branch": "main", "date": "2026-02-24", "author": "Test"}
    result = render_template_content(content, variables)
    assert "Branch: main" in result
    assert "Date: 2026-02-24" in result
    assert "Author: Test" in result


def test_render_template_content_unknown_var():
    content = "{{branch}} - {{unknown}}"
    variables = {"branch": "main"}
    result = render_template_content(content, variables)
    assert result == "main - {{unknown}}"


def test_render_template_content_no_vars():
    content = "No variables here"
    variables = {"branch": "main"}
    result = render_template_content(content, variables)
    assert result == "No variables here"
