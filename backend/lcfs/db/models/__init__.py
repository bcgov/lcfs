"""lcfs models."""
import pkgutil
from pathlib import Path


# def load_all_models() -> None:
#     """Load all models from this folder."""
#     package_dir = Path(__file__).resolve().parent
#     modules = pkgutil.walk_packages(
#         path=[str(package_dir)],
#         prefix="lcfs.db.models.",
#     )
#     for module in modules:
#         __import__(module.name)  # noqa: WPS421

from . import OrganizationType
from . import OrganizationAddress
from . import OrganizationAttorneyAddress
from . import OrganizationStatus
from . import OrganizationBalance
from . import Organization
from . import Role
from . import User
from . import UserRole
from . import UserLoginHistory