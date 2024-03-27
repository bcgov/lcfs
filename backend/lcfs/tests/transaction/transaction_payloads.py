from datetime import datetime
from lcfs.web.api.transfer.schema import TransferCreate, TransferUpdate
from lcfs.db.models.Transfer import Transfer

agreement_date = datetime.strptime("2023-01-01", "%Y-%m-%d").date()

# transfer orm models
agreement_date = datetime.strptime("2023-01-01", "%Y-%m-%d").date()
transaction_orm_model = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    current_status_id=2,
    transfer_category_id=1,
    agreement_date=agreement_date,
    quantity=100,
    price_per_unit=10.0,
    signing_authority_declaration=True
)

agreement_date = datetime.strptime("2024-02-02", "%Y-%m-%d").date()
transaction_orm_model_2 = Transfer(
    from_organization_id=2,
    to_organization_id=1,
    current_status_id=2,
    transfer_category_id=1,
    agreement_date=agreement_date,
    quantity=20,
    price_per_unit=2.0,
    signing_authority_declaration=True
)
