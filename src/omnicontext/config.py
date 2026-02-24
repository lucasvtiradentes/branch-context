from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from omnicontext.assets import get_default_config
from omnicontext.constants import BRANCHES_DIR, CONFIG_DIR, CONFIG_FILE, TEMPLATE_DIR

_DEFAULTS = get_default_config()


@dataclass
class SyncConfig:
    provider: str = field(default_factory=lambda: _DEFAULTS["sync"]["provider"])
    gcp_bucket: str | None = None
    gcp_credentials_file: str | None = None


@dataclass
class Config:
    symlink: str = field(default_factory=lambda: _DEFAULTS["symlink"])
    on_switch: str | None = field(default_factory=lambda: _DEFAULTS["on_switch"])
    sound: bool = field(default_factory=lambda: _DEFAULTS["sound"])
    sound_file: str | None = None
    sync: SyncConfig = field(default_factory=SyncConfig)

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

        sync_data = data.get("sync", {})
        sync_config = SyncConfig(
            provider=sync_data.get("provider", _DEFAULTS["sync"]["provider"]),
            gcp_bucket=sync_data.get("gcp", {}).get("bucket"),
            gcp_credentials_file=sync_data.get("gcp", {}).get("credentials_file"),
        )

        return cls(
            symlink=data.get("symlink", _DEFAULTS["symlink"]),
            on_switch=data.get("on_switch"),
            sound=data.get("sound", _DEFAULTS["sound"]),
            sound_file=data.get("sound_file"),
            sync=sync_config,
        )

    def save(self, workspace: str):
        config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)

        data = {
            "symlink": self.symlink,
            "sound": self.sound,
            "sync": {
                "provider": self.sync.provider,
            },
        }

        if self.on_switch:
            data["on_switch"] = self.on_switch

        if self.sound_file:
            data["sound_file"] = self.sound_file

        if self.sync.gcp_bucket:
            data["sync"]["gcp"] = {
                "bucket": self.sync.gcp_bucket,
                "credentials_file": self.sync.gcp_credentials_file,
            }

        with open(config_path, "w") as f:
            json.dump(data, f, indent=2)


def get_config_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR)


def get_branches_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR, BRANCHES_DIR)


def get_template_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR, TEMPLATE_DIR)


def config_exists(workspace: str) -> bool:
    return os.path.exists(os.path.join(workspace, CONFIG_DIR, CONFIG_FILE))
