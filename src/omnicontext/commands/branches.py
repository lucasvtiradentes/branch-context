import os

from omnicontext.config import config_exists
from omnicontext.hooks import get_current_branch, get_git_root
from omnicontext.sync import get_branch_dir, list_branches


def cmd_branches(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print("error: not initialized. Run 'omnicontext init' first")
        return 1

    branches = list_branches(git_root)
    current = get_current_branch(git_root)

    if not branches:
        print("No branch contexts yet")
        return 0

    print(f"Branch contexts ({len(branches)}):\n")
    for b in sorted(branches):
        branch_dir = get_branch_dir(git_root, b)
        files = os.listdir(branch_dir) if os.path.exists(branch_dir) else []
        files = [f for f in files if not f.startswith(".")]
        marker = "*" if current and b == current.replace("/", "-") else " "
        print(f"  {marker} {b} ({len(files)} files)")

    return 0
