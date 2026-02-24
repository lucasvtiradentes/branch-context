from importlib.metadata import version as pkg_version

from branchctx.constants import DIST_NAME

__version__ = pkg_version(DIST_NAME)
