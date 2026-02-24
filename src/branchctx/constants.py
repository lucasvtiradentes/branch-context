PACKAGE_NAME = "branch-ctx"
CLI_NAME = "bctx"
CLI_ALIASES = ["branch-ctx", "bctx"]
ENV_BRANCH = "BRANCH_CTX_BRANCH"

GIT_DIR = ".git"
HOOK_NAME = "post-checkout"
HOOK_MARKER = "# branch-ctx-managed"
DEFAULT_SOUND_FILE = "notification.oga"

CONFIG_DIR = ".bctx"
CONFIG_FILE = "config.json"
TEMPLATES_DIR = "templates"
DEFAULT_TEMPLATE = "_default"
BRANCHES_DIR = "branches"
DEFAULT_SYMLINK = "_context"
