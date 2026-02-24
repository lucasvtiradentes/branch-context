from __future__ import annotations

from pathlib import Path

ASSETS_DIR = Path(__file__).parent / "assets"


def get_asset(name: str) -> str:
    return (ASSETS_DIR / name).read_text()


def get_template_context() -> str:
    return get_asset("template_context.md")


def get_gitignore_branches() -> str:
    return get_asset("gitignore_branches")


def get_gitignore_root() -> str:
    return get_asset("gitignore_root")


def get_hook_template() -> str:
    return get_asset("hook_template.sh")


def get_sound_path(name: str) -> Path:
    return ASSETS_DIR / name
