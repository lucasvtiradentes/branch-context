import json
import os
from dataclasses import dataclass, field

from omnicontext.constants import CONFIG_DIR, CONFIG_FILE

DEFAULT_CONFIG = {
    "symlink": ".branch-context",
    "on_switch": None,
    "sync": {
        "provider": "local",
    },
}


@dataclass
class SyncConfig:
    provider: str = "local"
    gcp_bucket: str | None = None
    gcp_credentials_file: str | None = None


@dataclass
class Config:
    symlink: str = ".branch-context"
    on_switch: str | None = None
    sync: SyncConfig = field(default_factory=SyncConfig)

    @classmethod
    def load(cls, workspace: str) -> "Config":
        config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)

        if not os.path.exists(config_path):
            return cls()

        with open(config_path) as f:
            data = json.load(f)

        sync_data = data.get("sync", {})
        sync_config = SyncConfig(
            provider=sync_data.get("provider", "local"),
            gcp_bucket=sync_data.get("gcp", {}).get("bucket"),
            gcp_credentials_file=sync_data.get("gcp", {}).get("credentials_file"),
        )

        return cls(
            symlink=data.get("symlink", ".branch-context"),
            on_switch=data.get("on_switch"),
            sync=sync_config,
        )

    def save(self, workspace: str):
        config_path = os.path.join(workspace, CONFIG_DIR, CONFIG_FILE)

        data = {
            "symlink": self.symlink,
            "on_switch": self.on_switch,
            "sync": {
                "provider": self.sync.provider,
            },
        }

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
    return os.path.join(workspace, CONFIG_DIR, "branches")


def get_template_dir(workspace: str) -> str:
    return os.path.join(workspace, CONFIG_DIR, "template")


def config_exists(workspace: str) -> bool:
    return os.path.exists(os.path.join(workspace, CONFIG_DIR, CONFIG_FILE))
