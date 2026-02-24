import os

from omnicontext.assets import get_gitignore_branches, get_gitignore_root, get_template_context
from omnicontext.config import Config, config_exists, get_branches_dir, get_config_dir, get_template_dir
from omnicontext.constants import CLI_NAME, CONFIG_FILE
from omnicontext.hooks import get_git_root


def cmd_init(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    config_dir = get_config_dir(git_root)
    template_dir = get_template_dir(git_root)
    branches_dir = get_branches_dir(git_root)

    if config_exists(git_root):
        print(f"Already initialized: {config_dir}")
        return 0

    os.makedirs(config_dir, exist_ok=True)
    os.makedirs(template_dir, exist_ok=True)
    os.makedirs(branches_dir, exist_ok=True)

    config = Config()
    config.save(git_root)

    with open(os.path.join(template_dir, "context.md"), "w") as f:
        f.write(get_template_context())

    with open(os.path.join(branches_dir, ".gitignore"), "w") as f:
        f.write(get_gitignore_branches())

    with open(os.path.join(config_dir, ".gitignore"), "w") as f:
        f.write(get_gitignore_root())

    print(f"Initialized: {config_dir}")
    print(f"  config:   {config_dir}/{CONFIG_FILE}")
    print(f"  template: {template_dir}/")
    print(f"  branches: {branches_dir}/ (gitignored)")
    print("")
    print(f"Next: run '{CLI_NAME} install' to install the hook")
    return 0
