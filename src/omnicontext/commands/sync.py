from omnicontext.config import config_exists
from omnicontext.hooks import get_current_branch, get_git_root
from omnicontext.sync import sync_branch


def cmd_sync(_args):
    git_root = get_git_root()
    if not git_root:
        print("error: not a git repository")
        return 1

    if not config_exists(git_root):
        print("error: not initialized. Run 'omnicontext init' first")
        return 1

    branch = get_current_branch(git_root)
    if not branch:
        print("error: could not determine current branch")
        return 1

    result = sync_branch(git_root, branch)

    print(f"Branch:  {result['branch']}")
    print(f"Context: {result['branch_dir']}")
    print(f"Symlink: {result['symlink_path']} -> {result['branch_dir']}")

    if result["create_result"] == "created_from_template":
        print("Status:  created from template")
    elif result["create_result"] == "created_empty":
        print("Status:  created (no template)")
    else:
        print("Status:  exists")

    return 0
