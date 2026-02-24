from __future__ import annotations

import json
from pathlib import Path

ASSETS_DIR = Path(__file__).parent


def get_asset(name: str) -> str:
    return (ASSETS_DIR / name).read_text()


def get_default_config() -> dict:
    return json.loads(get_asset("default_config.json"))


def get_template_context() -> str:
    return get_asset("template_context.md")


def get_gitignore() -> str:
    return get_asset("gitignore")


def get_hook_template() -> str:
    return get_asset("hook_template.sh")


def get_sound_path(name: str) -> Path:
    return ASSETS_DIR / name
