from __future__ import annotations

import subprocess
from typing import Literal


def git_init(path: str, branch: str | None = None) -> subprocess.CompletedProcess:
    cmd = ["git", "init"]
    if branch:
        cmd.extend(["-b", branch])
    return subprocess.run(cmd, cwd=path, capture_output=True, text=True, check=True)


def git_config(path: str, key: str, value: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "config", key, value], cwd=path, capture_output=True, text=True)


def git_add(path: str, files: str = ".") -> subprocess.CompletedProcess:
    return subprocess.run(["git", "add", files], cwd=path, capture_output=True, text=True)


def git_commit(path: str, message: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "commit", "-m", message], cwd=path, capture_output=True, text=True, check=True)


def git_checkout(path: str, branch: str, create: bool = False) -> subprocess.CompletedProcess:
    cmd = ["git", "checkout"]
    if create:
        cmd.append("-b")
    cmd.append(branch)
    return subprocess.run(cmd, cwd=path, capture_output=True, text=True, check=True)


def git_current_branch(path: str) -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=path,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return result.stdout.strip()

    head_file = f"{path}/.git/HEAD"
    try:
        with open(head_file) as f:
            content = f.read().strip()
        if content.startswith("ref: refs/heads/"):
            return content[16:]
    except FileNotFoundError:
        pass

    return None


def git_root(path: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=path,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def git_config_get(key: str, scope: Literal["global"] | None = None, path: str | None = None) -> str | None:
    cmd = ["git", "config"]
    if scope == "global":
        cmd.append("--global")
    cmd.append(key)
    try:
        result = subprocess.run(cmd, cwd=path, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def git_user_name(path: str | None = None) -> str | None:
    return git_config_get("user.name", path=path)


def git_config_unset(key: str, scope: Literal["global"] | None = None) -> bool:
    cmd = ["git", "config", "--unset"]
    if scope == "global":
        cmd.insert(2, "--global")
    cmd.append(key)
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError:
        return False


def git_list_branches(path: str) -> list[str]:
    try:
        result = subprocess.run(
            ["git", "branch", "--format=%(refname:short)"],
            cwd=path,
            capture_output=True,
            text=True,
            check=True,
        )
        return [b.strip() for b in result.stdout.strip().split("\n") if b.strip()]
    except subprocess.CalledProcessError:
        return []


def git_hooks_path(path: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "config", "--get", "core.hooksPath"],
            cwd=path,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def git_info_exclude_add(path: str, pattern: str) -> bool:
    exclude_file = f"{path}/.git/info/exclude"
    try:
        existing = ""
        try:
            with open(exclude_file) as f:
                existing = f.read()
        except FileNotFoundError:
            pass

        if pattern in existing.splitlines():
            return True

        with open(exclude_file, "a") as f:
            if existing and not existing.endswith("\n"):
                f.write("\n")
            f.write(f"{pattern}\n")
        return True
    except (OSError, IOError):
        return False
