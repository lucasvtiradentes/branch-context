from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime

from branchctx.constants import ARCHIVED_DIR, META_FILE
from branchctx.data.config import get_branches_dir
from branchctx.utils.git import git_user_name


def _get_meta_path(workspace: str) -> str:
    return os.path.join(get_branches_dir(workspace), META_FILE)


def _get_archived_meta_path(workspace: str) -> str:
    return os.path.join(get_branches_dir(workspace), ARCHIVED_DIR, META_FILE)


def _load_meta(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_meta(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _get_last_commit(workspace: str) -> dict | None:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%H|%s|%aI"],
            cwd=workspace,
            capture_output=True,
            text=True,
            check=True,
        )
        parts = result.stdout.strip().split("|", 2)
        if len(parts) == 3:
            return {"hash": parts[0][:7], "message": parts[1], "datetime": parts[2]}
    except subprocess.CalledProcessError:
        pass
    return None


def _get_commits_since_base(workspace: str, base_branch: str) -> str:
    try:
        result = subprocess.run(
            ["git", "log", f"{base_branch}..HEAD", "--oneline"],
            cwd=workspace,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def _get_changed_files(workspace: str, base_branch: str) -> str:
    try:
        status_result = subprocess.run(
            ["git", "diff", "--name-status", "-M100", f"{base_branch}...HEAD"],
            cwd=workspace,
            capture_output=True,
            text=True,
            check=True,
        )
        numstat_result = subprocess.run(
            ["git", "diff", "--numstat", "-M100", f"{base_branch}...HEAD"],
            cwd=workspace,
            capture_output=True,
            text=True,
            check=True,
        )

        status_lines = status_result.stdout.strip().split("\n")
        numstat_lines = numstat_result.stdout.strip().split("\n")

        if not status_lines or status_lines == [""]:
            return ""

        file_stats: dict[str, tuple[str, str]] = {}
        for line in numstat_lines:
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                added, removed = parts[0], parts[1]
                filepath = parts[2] if len(parts) == 3 else parts[3]
                file_stats[filepath] = (added, removed)

        files: list[tuple[str, str, str, str, str]] = []
        for line in status_lines:
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2:
                status = parts[0][0]
                if status == "R" and len(parts) >= 3:
                    old_path, new_path = parts[1], parts[2]
                    added, removed = file_stats.get(new_path, ("0", "0"))
                    files.append((status, new_path, old_path, added, removed))
                else:
                    filepath = parts[-1]
                    added, removed = file_stats.get(filepath, ("0", "0"))
                    files.append((status, filepath, "", added, removed))

        if not files:
            return ""

        def get_display_path(f: tuple) -> str:
            status, filepath, old_path = f[0], f[1], f[2]
            if status == "R" and old_path:
                return f"{filepath}  <-  {old_path}"
            return filepath

        max_display_len = max(len(get_display_path(f)) for f in files)
        result_lines = []
        for status, filepath, old_path, added, removed in files:
            display_path = get_display_path((status, filepath, old_path, added, removed))
            padded_display = display_path.ljust(max_display_len)
            result_lines.append(f"{status}  {padded_display}  (+{added} -{removed})")

        return "\n".join(result_lines)
    except subprocess.CalledProcessError:
        return ""


def load_branch_meta(workspace: str) -> dict:
    return _load_meta(_get_meta_path(workspace))


def load_archived_meta(workspace: str) -> dict:
    return _load_meta(_get_archived_meta_path(workspace))


def get_branch_meta(workspace: str, branch_key: str) -> dict | None:
    meta = load_branch_meta(workspace)
    return meta.get(branch_key)


def create_branch_meta(workspace: str, branch_key: str, branch: str):
    meta = load_branch_meta(workspace)
    now = datetime.now().isoformat()

    if branch_key not in meta:
        meta[branch_key] = {
            "branch": branch,
            "created_at": now,
            "author": git_user_name(workspace),
            "updated_at": now,
            "last_commit": None,
            "commits": "",
            "changed_files": "",
        }
        _save_meta(_get_meta_path(workspace), meta)


def update_branch_meta(workspace: str, branch_key: str, base_branch: str):
    meta = load_branch_meta(workspace)
    if branch_key not in meta:
        return

    now = datetime.now().isoformat()
    commits = _get_commits_since_base(workspace, base_branch)
    changed_files = _get_changed_files(workspace, base_branch)
    last_commit = _get_last_commit(workspace)

    meta[branch_key]["updated_at"] = now
    meta[branch_key]["last_commit"] = last_commit
    meta[branch_key]["commits"] = commits
    meta[branch_key]["changed_files"] = changed_files

    _save_meta(_get_meta_path(workspace), meta)


def archive_branch_meta(workspace: str, branch_key: str):
    meta = load_branch_meta(workspace)
    if branch_key not in meta:
        return

    branch_data = meta.pop(branch_key)
    _save_meta(_get_meta_path(workspace), meta)

    archived = load_archived_meta(workspace)
    archived[branch_key] = branch_data
    _save_meta(_get_archived_meta_path(workspace), archived)


def delete_branch_meta(workspace: str, branch_key: str):
    meta = load_branch_meta(workspace)
    if branch_key in meta:
        del meta[branch_key]
        _save_meta(_get_meta_path(workspace), meta)
