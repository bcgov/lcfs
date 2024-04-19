from lcfs.db.models.Transaction import TransactionActionEnum, Transaction

# Transactions ORM Models
adjustment_transaction_orm_model = Transaction(
    compliance_units=100,
    organization_id=1,
    transaction_action=TransactionActionEnum.Adjustment
)

reserved_transaction_orm_model = Transaction(
    compliance_units=10,
    organization_id=1,
    transaction_action=TransactionActionEnum.Reserved
)

reserved_transaction_orm_model_2 = Transaction(
    compliance_units=20,
    organization_id=1,
    transaction_action=TransactionActionEnum.Reserved
)
