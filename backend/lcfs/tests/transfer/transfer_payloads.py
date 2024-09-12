from datetime import datetime
from lcfs.web.api.transfer.schema import TransferCreateSchema, TransferUpdate
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum

agreement_date = datetime.strptime("2023-01-01", "%Y-%m-%d").date()

# create payloads
transfer_create_payload = TransferCreateSchema(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-01-01",
    quantity=100,
    price_per_unit=10.0,
    from_org_comment="Comments added by transferer organization",
)

transfer_create_payload_2 = TransferCreateSchema(
    from_organization_id=2,
    to_organization_id=1,
    agreement_date="2024-03-03",
    quantity=300,
    price_per_unit=3.0,
    from_org_comment="Comments added by transferer organization",
)

transfer_create_payload_3 = TransferCreateSchema(
    transfer_id=1,
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-01-01",
    currentStatus="Refused",
)

# update payloads
transfer_update_payload = TransferCreateSchema(
    transfer_id=1,
    from_organization_id=1,
    to_organization_id=3,
    agreement_date="2023-02-02",
    quantity=50,
    price_per_unit=5.0,
    from_org_comment="Comments added by transferer organization",
)

transfer_update_draft_payload = TransferCreateSchema(
    transfer_id=2,
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-04-04",
    quantity=40,
    price_per_unit=4.0,
    from_org_comment="Comments added by transferer organization",
)

transfer_update_payload_2 = TransferUpdate(
    comments="Initial Transfer",
    current_status_id=1,
)

transfer_update_payload_3 = {
    "agreementDate": "2024-04-11",
    "currentStatus": "Refused",
    "fromOrgComment": "",
    "fromOrganizationId": 1,
    "govComment": "",
    "pricePerUnit": 100,
    "quantity": 100,
    "recommendation": "Record",
    "toOrgComment": "",
    "toOrganizationId": 2,
}

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
)

agreement_date = datetime.strptime("2024-02-02", "%Y-%m-%d").date()
transfer_orm_model_3 = Transfer(
    transfer_id=1,
    from_organization_id=1,
    to_organization_id=2,
    current_status_id=5,
    transfer_category_id=1,
    agreement_date=agreement_date,
    quantity=20,
    price_per_unit=2.0,
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
}

# transaction orm models
transaction_orm_model = Transaction(
    transaction_id=1,
    compliance_units=100,
    organization_id=1,
    transaction_action=TransactionActionEnum.Reserved,
)

# transfer history orm models
transfer_history_orm_model = TransferHistory(
    transfer_id=1, transfer_status_id=5, user_profile_id=1, create_user="HVALIOLL"
)
