import os
import tempfile

import pytest

from branchctx.core.context_tags import (
    SYNC_MESSAGE_TEMPLATE,
    TAG_COMMITS,
    TAG_FILES,
    find_context_files,
    find_tags_in_file,
    update_tag_content,
)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


def test_find_context_files_empty_dir(temp_dir):
    result = find_context_files(temp_dir)
    assert result == []


def test_find_context_files_with_md_files(temp_dir):
    md_file = os.path.join(temp_dir, "context.md")
    with open(md_file, "w") as f:
        f.write("# Test")

    result = find_context_files(temp_dir)
    assert len(result) == 1
    assert md_file in result


def test_find_context_files_with_txt_files(temp_dir):
    txt_file = os.path.join(temp_dir, "notes.txt")
    with open(txt_file, "w") as f:
        f.write("notes")

    result = find_context_files(temp_dir)
    assert len(result) == 1
    assert txt_file in result


def test_find_context_files_ignores_other_extensions(temp_dir):
    py_file = os.path.join(temp_dir, "script.py")
    with open(py_file, "w") as f:
        f.write("print('hello')")

    result = find_context_files(temp_dir)
    assert result == []


def test_find_context_files_nested_dirs(temp_dir):
    subdir = os.path.join(temp_dir, "subdir")
    os.makedirs(subdir)

    md_file = os.path.join(subdir, "nested.md")
    with open(md_file, "w") as f:
        f.write("# Nested")

    result = find_context_files(temp_dir)
    assert len(result) == 1
    assert md_file in result


def test_find_context_files_nonexistent_dir():
    result = find_context_files("/nonexistent/path")
    assert result == []


def test_find_tags_in_file_no_tags(temp_dir):
    file_path = os.path.join(temp_dir, "test.md")
    with open(file_path, "w") as f:
        f.write("# No tags here")

    result = find_tags_in_file(file_path)
    assert result == []


def test_find_tags_in_file_with_commits_tag(temp_dir):
    file_path = os.path.join(temp_dir, "test.md")
    with open(file_path, "w") as f:
        f.write("<bctx:commits>old content</bctx:commits>")

    result = find_tags_in_file(file_path)
    assert len(result) == 1
    assert result[0] == (TAG_COMMITS, "old content")


def test_find_tags_in_file_with_files_tag(temp_dir):
    file_path = os.path.join(temp_dir, "test.md")
    with open(file_path, "w") as f:
        f.write("<bctx:files>file list</bctx:files>")

    result = find_tags_in_file(file_path)
    assert len(result) == 1
    assert result[0] == (TAG_FILES, "file list")


def test_find_tags_in_file_with_both_tags(temp_dir):
    file_path = os.path.join(temp_dir, "test.md")
    with open(file_path, "w") as f:
        f.write("<bctx:commits>commits</bctx:commits>\n<bctx:files>files</bctx:files>")

    result = find_tags_in_file(file_path)
    assert len(result) == 2
    assert (TAG_COMMITS, "commits") in result
    assert (TAG_FILES, "files") in result


def test_find_tags_in_file_multiline_content(temp_dir):
    file_path = os.path.join(temp_dir, "test.md")
    content = "<bctx:commits>\nabc123 first\ndef456 second\n</bctx:commits>"
    with open(file_path, "w") as f:
        f.write(content)

    result = find_tags_in_file(file_path)
    assert len(result) == 1
    assert result[0][0] == TAG_COMMITS
    assert "abc123 first" in result[0][1]


def test_find_tags_in_file_nonexistent():
    result = find_tags_in_file("/nonexistent/file.md")
    assert result == []


def test_update_tag_content():
    content = "<bctx:commits>old</bctx:commits>"
    result = update_tag_content(content, TAG_COMMITS, "new")
    assert result == "<bctx:commits>new</bctx:commits>"


def test_update_tag_content_preserves_other_content():
    content = "# Header\n<bctx:commits>old</bctx:commits>\n## Footer"
    result = update_tag_content(content, TAG_COMMITS, "new")
    assert "# Header" in result
    assert "## Footer" in result
    assert "<bctx:commits>new</bctx:commits>" in result


def test_update_tag_content_only_affects_specified_tag():
    content = "<bctx:commits>commits</bctx:commits><bctx:files>files</bctx:files>"
    result = update_tag_content(content, TAG_COMMITS, "updated")
    assert "<bctx:commits>updated</bctx:commits>" in result
    assert "<bctx:files>files</bctx:files>" in result


def test_sync_message_template():
    message = SYNC_MESSAGE_TEMPLATE.format(base_branch="origin/main")
    assert "origin/main" in message
    assert "N/A" in message
