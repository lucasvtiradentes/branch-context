from __future__ import annotations

import json
import shutil
from pathlib import Path

ASSETS_DIR = Path(__file__).parent
INIT_DIR = ASSETS_DIR / "init"


def get_asset(name: str) -> str:
    return (ASSETS_DIR / name).read_text()


def get_init_asset(name: str) -> str:
    return (INIT_DIR / name).read_text()


def get_default_config() -> dict:
    return json.loads(get_init_asset("config.json"))


def get_gitignore() -> str:
    return get_init_asset("gitignore")


def get_hook_template() -> str:
    return get_init_asset("hook_template.sh")


def get_init_templates_dir() -> Path:
    return INIT_DIR / "templates"


def copy_init_templates(dest: Path):
    src = get_init_templates_dir()
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
