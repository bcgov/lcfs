"""lcfs models."""
from pathlib import Path
import pkgutil

def load_all_models() -> None:
    """Load all models from this folder, loading specific models first."""

    # Models that need to be loaded first
    priority_models = [
      'OrganizationStatus',
      'Organization', 
      'UserProfile', 
      'Role'
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


from . import OrganizationType
from . import OrganizationStatus
from . import OrganizationAddress
from . import OrganizationAttorneyAddress
from . import OrganizationStatus
from . import OrganizationBalance
from . import Organization
from . import Role
from . import UserProfile
from . import UserRole
from . import UserLoginHistory
from . import TransferCategory
from . import Comment
from . import NotificationChannel
from . import NotificationType
from . import NotificationChannelSubscription
from . import NotificationMessage
from . import Transaction
from . import TransactionType
from . import AdminAdjustment
from . import AdminAdjustmentStatus
from . import AdminAdjustmentHistory
from . import InitiativeAgreement
from . import InitiativeAgreementStatus
from . import InitiativeAgreementHistory
from . import Transfer
from . import TransferHistory
from . import TransferStatus