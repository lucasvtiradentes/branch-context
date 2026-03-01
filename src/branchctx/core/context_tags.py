from __future__ import annotations

import os
import re
from dataclasses import dataclass

from branchctx.constants import CONTEXT_FILE_EXTENSIONS
from branchctx.data.meta import get_branch_meta

TAG_COMMITS = "bctx:commits"
TAG_FILES = "bctx:files"
TAG_PATTERN = re.compile(r"<(bctx:(?:commits|files))>(.*?)</\1>", re.DOTALL)
SYNC_MESSAGE_TEMPLATE = "N/A - in sync with {base_branch}"


@dataclass
class TagUpdate:
    file: str
    tag: str
    old_content: str
    new_content: str


def find_context_files(context_dir: str) -> list[str]:
    if not os.path.isdir(context_dir):
        return []

    files = []
    for root, _, filenames in os.walk(context_dir):
        for filename in filenames:
            if filename.endswith(CONTEXT_FILE_EXTENSIONS):
                files.append(os.path.join(root, filename))
    return files


def find_tags_in_file(filepath: str) -> list[tuple[str, str]]:
    try:
        with open(filepath, "r") as f:
            content = f.read()
    except (OSError, IOError):
        return []

    return [(match.group(1), match.group(2)) for match in TAG_PATTERN.finditer(content)]


def update_tag_content(content: str, tag: str, new_value: str) -> str:
    pattern = re.compile(rf"<({re.escape(tag)})>(.*?)</\1>", re.DOTALL)
    return pattern.sub(rf"<\1>{new_value}</\1>", content)


def update_context_tags(
    workspace: str,
    context_dir: str,
    branch_key: str,
    base_branch: str,
) -> list[TagUpdate]:
    updates: list[TagUpdate] = []

    meta = get_branch_meta(workspace, branch_key)
    sync_message = SYNC_MESSAGE_TEMPLATE.format(base_branch=base_branch)

    if meta:
        commits_content = meta.get("commits") or sync_message
        files_content = meta.get("changed_files") or sync_message
    else:
        commits_content = sync_message
        files_content = sync_message

    context_files = find_context_files(context_dir)

    for filepath in context_files:
        try:
            with open(filepath, "r") as f:
                original_content = f.read()
        except (OSError, IOError):
            continue

        tags = find_tags_in_file(filepath)
        if not tags:
            continue

        new_content = original_content
        file_updates = []

        tag_content_map = {
            TAG_COMMITS: commits_content,
            TAG_FILES: files_content,
        }

        for tag, old_value in tags:
            if tag not in tag_content_map:
                continue

            content_value = tag_content_map[tag]
            new_value = f"\n{content_value}\n"
            new_content = update_tag_content(new_content, tag, new_value)
            file_updates.append(
                TagUpdate(
                    file=filepath,
                    tag=tag,
                    old_content=old_value.strip(),
                    new_content=content_value,
                )
            )

        if new_content != original_content:
            with open(filepath, "w") as f:
                f.write(new_content)
            updates.extend(file_updates)

    return updates
