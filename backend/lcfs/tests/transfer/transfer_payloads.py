from datetime import datetime
from lcfs.web.api.transfer.schema import TransferCreateSchema, TransferUpdate
from lcfs.db.models.Transfer import Transfer

agreement_date = datetime.strptime("2023-01-01", "%Y-%m-%d").date()

# create payloads
transfer_create_payload = TransferCreateSchema(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-01-01",
    quantity=100,
    price_per_unit=10.0,
    signing_authority_declaration=True,
    from_org_comment="Comments added by transferer organization"
)

transfer_create_payload_2 = TransferCreateSchema(
    from_organization_id=2,
    to_organization_id=1,
    agreement_date="2024-03-03",
    quantity=300,
    price_per_unit=3.0,
    signing_authority_declaration=True,
    from_org_comment="Comments added by transferer organization"
)

# update payloads
transfer_update_payload = TransferCreateSchema(
    transfer_id=1,
    from_organization_id=1,
    to_organization_id=3,
    agreement_date="2023-02-02",
    quantity=50,
    price_per_unit=5.0,
    signing_authority_declaration=True,
    from_org_comment="Comments added by transferer organization"
)

transfer_update_draft_payload = TransferCreateSchema(
    transfer_id=2,
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-04-04",
    quantity=40,
    price_per_unit=4.0,
    signing_authority_declaration=True,
    from_org_comment="Comments added by transferer organization"
)

transfer_update_payload_2 = TransferUpdate(
    comments="Initial Transfer",
    current_status_id=1,
)

# transfer orm models
agreement_date = datetime.strptime("2023-01-01", "%Y-%m-%d").date()
transfer_orm_model = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    current_status_id=1,
    transfer_category_id=1,
    agreement_date=agreement_date,
    quantity=100,
    price_per_unit=10.0,
    signing_authority_declaration=True
)

agreement_date = datetime.strptime("2024-02-02", "%Y-%m-%d").date()
transfer_orm_model_2 = Transfer(
    from_organization_id=2,
    to_organization_id=1,
    current_status_id=1,
    transfer_category_id=1,
    agreement_date=agreement_date,
    quantity=20,
    price_per_unit=2.0,
    signing_authority_declaration=True
)

agreement_date = datetime.strptime("2024-02-02", "%Y-%m-%d").date()
transfer_orm_fields = {
    "from_organization_id": 2,
    "to_organization_id": 1,
    "current_status_id": 1,
    "transfer_category_id": 1,
    "agreement_date": agreement_date,
    "quantity": 20,
    "price_per_unit": 2.0,
    "signing_authority_declaration": True
}
