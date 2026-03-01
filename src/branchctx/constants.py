DIST_NAME = "branch-ctx"
PACKAGE_NAME = "branchctx"
CLI_NAME = "bctx"
CLI_ALIASES = ["branch-ctx", "bctx"]
ENV_BRANCH = "BRANCH_CTX_BRANCH"

GIT_DIR = ".git"
HOOK_MARKER = "# branch-ctx-managed"
HOOK_POST_CHECKOUT = "post-checkout"
HOOK_POST_COMMIT = "post-commit"
DEFAULT_SOUND_FILE = "notification.oga"

CONFIG_DIR = ".bctx"
CONFIG_FILE = "config.json"
META_FILE = "meta.json"
BASE_BRANCH_FILE = "base_branch"
TEMPLATES_DIR = "templates"
BRANCHES_DIR = "branches"
ARCHIVED_DIR = "_archived"

DEFAULT_SYMLINK = "_context"
DEFAULT_TEMPLATE = "_default"

TEMPLATE_FILE_EXTENSIONS = (".md", ".txt", ".json", ".yaml", ".yml", ".toml")
CONTEXT_FILE_EXTENSIONS = (".md", ".txt")
