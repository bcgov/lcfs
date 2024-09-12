from datetime import datetime
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatusEnum,
    AdminAdjustmentStatus,
)
from lcfs.db.models.admin_adjustment import AdminAdjustment


# Utility function to format datetime for consistency
def formatted_date():
    return datetime.strptime("2023-01-01", "%Y-%m-%d").date()


# Transfer ORM Models
draft_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=1,
    recommendation=TransferRecommendationEnum.Record,
)

deleted_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=2,
    recommendation=TransferRecommendationEnum.Record,
)

sent_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=3,
    recommendation=TransferRecommendationEnum.Record,
)

submitted_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=4,
    recommendation=TransferRecommendationEnum.Record,
)

recommended_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=5,
    recommendation=TransferRecommendationEnum.Record,
)

recorded_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=6,
    recommendation=TransferRecommendationEnum.Record,
)

refused_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=7,
    recommendation=TransferRecommendationEnum.Record,
)

declined_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=8,
    recommendation=TransferRecommendationEnum.Record,
)

rescinded_transfer_orm = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=9,
    recommendation=TransferRecommendationEnum.Record,
)

# InitiativeAgreementStatus ORM Models
initiative_agreement_status_orm = InitiativeAgreementStatus(
    initiative_agreement_status_id=1, status=InitiativeAgreementStatusEnum.Draft
)

# InitiativeAgreement ORM Models
initiative_agreement_orm = InitiativeAgreement(
    initiative_agreement_id=1,
    compliance_units=10,
    to_organization_id=1,
    current_status_id=1,
)

# AdminAdjustmentStatus ORM Models
admin_adjustment_status_orm = AdminAdjustmentStatus(
    admin_adjustment_status_id=1, status=AdminAdjustmentStatusEnum.Draft
)

# AdminAdjustment ORM Models
admin_adjustment_orm = AdminAdjustment(
    admin_adjustment_id=1,
    compliance_units=20,
    to_organization_id=1,
    current_status_id=1,
)
