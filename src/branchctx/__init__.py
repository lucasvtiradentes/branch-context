from importlib.metadata import version as pkg_version

from branchctx.constants import PACKAGE_NAME

__version__ = pkg_version(PACKAGE_NAME)
