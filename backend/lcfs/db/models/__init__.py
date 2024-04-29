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


# Explicit model imports
from . import (
    OrganizationType,
    OrganizationStatus,
    OrganizationAddress,
    OrganizationAttorneyAddress,
    OrganizationStatus,
    OrganizationBalance,
    Organization,
    Role,
    UserProfile,
    UserRole,
    UserLoginHistory,
    TransferCategory,
    Comment,
    InternalComment,
    NotificationChannel,
    NotificationType,
    NotificationChannelSubscription,
    NotificationMessage,
    Transaction,
    TransactionView,
    TransactionStatusView,
    TransferInternalComment,
    AdminAdjustment,
    AdminAdjustmentStatus,
    AdminAdjustmentHistory,
    InitiativeAgreement,
    InitiativeAgreementStatus,
    InitiativeAgreementHistory,
    InitiativeAgreementInternalComment,
    Transfer,
    TransferHistory,
    TransferStatus,
    FuelCode,
    FuelCodePrefix,
    FuelCodeStatus,
    FuelType,
    FeedstockFuelTransportMode,
    FinishedFuelTransportMode
)
