from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from branchctx.assets import get_default_config
from branchctx.constants import BRANCHES_DIR, CONFIG_DIR, CONFIG_FILE, DEFAULT_TEMPLATE, TEMPLATES_DIR

_DEFAULTS: dict | None = None


def _get_defaults() -> dict:
    global _DEFAULTS
    if _DEFAULTS is None:
        _DEFAULTS = get_default_config()
    return _DEFAULTS


@dataclass
class TemplateRule:
    prefix: str
    template: str


def _get_changed_files_defaults() -> dict:
    return _get_defaults()["changed_files"]


@dataclass
class ChangedFilesConfig:
    enabled: bool = field(default_factory=lambda: _get_changed_files_defaults()["enabled"])
    base_branch: str = field(default_factory=lambda: _get_changed_files_defaults()["base_branch"])


@dataclass
class Config:
    symlink: str = field(default_factory=lambda: _get_defaults()["symlink"])
    on_switch: str | None = field(default_factory=lambda: _get_defaults()["on_switch"])
    sound: bool = field(default_factory=lambda: _get_defaults()["sound"])
    sound_file: str | None = None
    template_rules: list[TemplateRule] = field(default_factory=list)
    changed_files: ChangedFilesConfig = field(default_factory=ChangedFilesConfig)

    @classmethod
    def load(cls, workspace: str) -> "Config":
        config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)

        if not os.path.exists(config_path):
            return cls()

        try:
            with open(config_path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return cls()

        defaults = _get_defaults()

        changed_files_data = data.get("changed_files", {})
        cf_defaults = _get_changed_files_defaults()
        changed_files_config = ChangedFilesConfig(
            enabled=changed_files_data.get("enabled", cf_defaults["enabled"]),
            base_branch=changed_files_data.get("base_branch", cf_defaults["base_branch"]),
        )

        template_rules = [
            TemplateRule(prefix=r["prefix"], template=r["template"]) for r in data.get("template_rules", [])
        ]

        return cls(
            symlink=data.get("symlink", defaults["symlink"]),
            on_switch=data.get("on_switch"),
            sound=data.get("sound", defaults["sound"]),
            sound_file=data.get("sound_file"),
            template_rules=template_rules,
            changed_files=changed_files_config,
        )

    def save(self, workspace: str):
        config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)

        data = {
            "symlink": self.symlink,
            "sound": self.sound,
            "template_rules": [{"prefix": r.prefix, "template": r.template} for r in self.template_rules],
            "changed_files": {
                "enabled": self.changed_files.enabled,
                "base_branch": self.changed_files.base_branch,
            },
        }

        if self.on_switch:
            data["on_switch"] = self.on_switch

        if self.sound_file:
            data["sound_file"] = self.sound_file

        with open(config_path, "w") as f:
            json.dump(data, f, indent=2)

    def get_template_for_branch(self, branch: str) -> str:
        for rule in self.template_rules:
            if branch.startswith(rule.prefix):
                return rule.template
        return DEFAULT_TEMPLATE


def get_config_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR)


def get_templates_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR, TEMPLATES_DIR)


def get_template_dir(workspace: str, template: str = DEFAULT_TEMPLATE) -> str:
    return os.path.join(workspace, CONFIG_DIR, TEMPLATES_DIR, template)


def get_branches_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR, BRANCHES_DIR)


def config_exists(workspace: str) -> bool:
    return os.path.exists(os.path.join(workspace, CONFIG_DIR, CONFIG_FILE))


def list_templates(workspace: str) -> list[str]:
    templates_dir = get_templates_dir(workspace)
    if not os.path.exists(templates_dir):
        return []
    return [d for d in os.listdir(templates_dir) if os.path.isdir(os.path.join(templates_dir, d))]
