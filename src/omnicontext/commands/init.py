import os

from omnicontext.assets import get_gitignore, get_template_context
from omnicontext.config import Config, config_exists, get_branches_dir, get_config_dir, get_template_dir
from omnicontext.constants import CONFIG_FILE
from omnicontext.hooks import get_git_root, install_hook


def cmd_init(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    config_dir = get_config_dir(git_root)
    template_dir = get_template_dir(git_root)
    branches_dir = get_branches_dir(git_root)

    already_initialized = config_exists(git_root)

    if not already_initialized:
        os.makedirs(config_dir, exist_ok=True)
        os.makedirs(template_dir, exist_ok=True)
        os.makedirs(branches_dir, exist_ok=True)

        config = Config()
        config.save(git_root)

        with open(os.path.join(template_dir, "context.md"), "w") as f:
            f.write(get_template_context())

        with open(os.path.join(config_dir, ".gitignore"), "w") as f:
            f.write(get_gitignore())

        print(f"Initialized: {config_dir}")
        print(f"  config:   {config_dir}/{CONFIG_FILE}")
        print(f"  template: {template_dir}/")
        print(f"  branches: {branches_dir}/ (gitignored)")

    hook_result = install_hook(git_root)

    if hook_result == "installed":
        print("Hook installed")
    elif hook_result == "already_installed":
        if already_initialized:
            print("Already initialized")
    elif hook_result == "hook_exists":
        print("warning: post-checkout hook exists but not managed by omnicontext")

    return 0
