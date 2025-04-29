from datetime import datetime, timedelta
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView

# Two organisations used by the repo-level checks
ORG_ID_1 = 901
ORG_ID_2 = 902

_NOW = datetime.utcnow()

ledger_row_1 = CreditLedgerView(
    transaction_id=1,
    transaction_type="Transfer",
    compliance_period="2023",
    organization_id=ORG_ID_1,
    compliance_units=100,
    available_balance=100,
    update_date=_NOW - timedelta(days=5),
)

ledger_row_2 = CreditLedgerView(
    transaction_id=2,
    transaction_type="Transfer",
    compliance_period="2024",
    organization_id=ORG_ID_1,
    compliance_units=-30,
    available_balance=70,
    update_date=_NOW - timedelta(days=2),
)

ledger_row_3 = CreditLedgerView(
    transaction_id=3,
    transaction_type="AdminAdjustment",
    compliance_period="2024",
    organization_id=ORG_ID_1,
    compliance_units=50,
    available_balance=120,
    update_date=_NOW - timedelta(days=1),
)

ledger_row_4 = CreditLedgerView(
    transaction_id=4,
    transaction_type="AdminAdjustment",
    compliance_period="2023",
    organization_id=ORG_ID_2,
    compliance_units=10,
    available_balance=10,
    update_date=_NOW - timedelta(days=3),
)

ledger_row_5 = CreditLedgerView(
    transaction_id=5,
    transaction_type="ComplianceReport",
    compliance_period="2024",
    organization_id=ORG_ID_2,
    compliance_units=-5,
    available_balance=5,
    update_date=_NOW - timedelta(days=1, hours=1),
)

ALL_ROWS = [
    ledger_row_1,
    ledger_row_2,
    ledger_row_3,
    ledger_row_4,
    ledger_row_5,
]
