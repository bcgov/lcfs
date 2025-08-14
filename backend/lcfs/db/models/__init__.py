"""lcfs models."""

from pathlib import Path
import pkgutil


def load_all_models() -> None:
    """Load all models from this folder, loading specific models first."""

    # Models that need to be loaded first
    priority_models = [
        "organization.OrganizationStatus",
        "organization.Organization",
        "user.UserProfile",
        "user.Role",
    ]

    # Load priority models
    for model_name in priority_models:
        __import__(f"lcfs.db.models.{model_name}")

    # Dynamically load the rest of the models
    package_dir = Path(__file__).resolve().parent
    modules = pkgutil.walk_packages(
        path=[str(package_dir)],
        prefix="lcfs.db.models.",
    )

    for module in modules:
        if module.name not in priority_models:
            __import__(module.name)  # noqa: WPS421


# Explicit model imports from subdirectories
from .admin_adjustment import *
from .comment import *
from .compliance import *
from .document import *
from .form import *
from .fuel import *
from .initiative_agreement import *
from .notification import *
from .organization import *
from .transaction import *
from .transfer import *
from .user import *
