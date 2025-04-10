import zoneinfo

from datetime import datetime

from lcfs.db.models import (
    Transaction,
    Organization,
    OrganizationAddress,
    InitiativeAgreement,
    AdminAdjustment,
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum


# Utility function to format datetime for consistency
def formatted_date():
    return datetime.strptime("2023-01-01", "%Y-%m-%d")


test_org_id = 111
test_org_2_id = 112

# Transfer ORM Models
test_org = Organization(
    organization_id=test_org_id,
    name="Test Company",
    operating_name="Test Co.",
    org_address=OrganizationAddress(
        street_address="123 Test St",
        city="Test City",
        province_state="Test Province",
        country="Test Country",
        postalCode_zipCode="T3ST 1Z3",
    ),
)

test_org_2 = Organization(
    organization_id=112,
    name="Test Company 2",
    operating_name="Test Co.",
    org_address=OrganizationAddress(
        street_address="123 Test St",
        city="Test City",
        province_state="Test Province",
        country="Test Country",
        postalCode_zipCode="T3ST 1Z3",
    ),
)

draft_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=1,
    recommendation=TransferRecommendationEnum.Record,
)

deleted_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=2,
    recommendation=TransferRecommendationEnum.Record,
)

sent_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=3,
    recommendation=TransferRecommendationEnum.Record,
)

submitted_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=4,
    recommendation=TransferRecommendationEnum.Record,
)


recommended_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=5,
    recommendation=TransferRecommendationEnum.Record,
)

recorded_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=6,
    recommendation=TransferRecommendationEnum.Record,
)

edge_case_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=6,
    recommendation=TransferRecommendationEnum.Record,
)

refused_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=7,
    recommendation=TransferRecommendationEnum.Record,
)

declined_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
    agreement_date=formatted_date(),
    transaction_effective_date=formatted_date(),
    price_per_unit=2.0,
    quantity=20,
    transfer_category_id=1,
    current_status_id=8,
    recommendation=TransferRecommendationEnum.Record,
)

rescinded_transfer_orm = Transfer(
    from_organization_id=test_org_id,
    to_organization_id=test_org_2_id,
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
    to_organization_id=test_org_id,
    current_status_id=1,
)

# AdminAdjustment ORM Models
admin_adjustment_orm = AdminAdjustment(
    admin_adjustment_id=200,
    compliance_units=20,
    to_organization_id=test_org_id,
    current_status_id=1,
)

reserved_transaction_orm = Transaction(
    transaction_id=4,
    transaction_action=TransactionActionEnum.Reserved,
    compliance_units=-100,
    organization_id=test_org_id,
    create_date=datetime.now(),
)

adjustment_transaction_orm = Transaction(
    transaction_id=5,
    transaction_action=TransactionActionEnum.Adjustment,
    compliance_units=100,
    organization_id=test_org_id,
    create_date=datetime.now(),
)

edge_case_transaction_orm = Transaction(
    transaction_id=6,
    transaction_action=TransactionActionEnum.Adjustment,
    compliance_units=133,
    organization_id=test_org_id,
    create_date=datetime.strptime(f"2023-03-31", "%Y-%m-%d").replace(
        hour=23,
        minute=59,
        second=0,
        tzinfo=zoneinfo.ZoneInfo("America/Vancouver"),
    ),
)
